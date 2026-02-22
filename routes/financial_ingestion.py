from fastapi import APIRouter, Depends
from database import get_db, add_clean_fillings_to_database
from database.orm import DocumentChunk, FinancialStatements
from database.financial_statements import get_or_fetch_financials
from database.yahoo_financial_statements import get_yahoo_financials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from datetime import date
from urllib.parse import urlparse

import asyncio
import yfinance as yf

router = APIRouter()


def _get_company_domain(ticker: str) -> str | None:
    """Extract company domain from yfinance info for logo lookups."""
    try:
        website = yf.Ticker(ticker).info.get("website")
        if website:
            return urlparse(website).netloc.replace("www.", "")
    except Exception:
        pass
    return None


@router.post("/ingestion/financials/{ticker_symbol}")
async def ingest_financials(ticker_symbol: str, db: AsyncSession = Depends(get_db)):
    # Fetch company domain in parallel (for logo lookups)
    domain_task = asyncio.create_task(asyncio.to_thread(_get_company_domain, ticker_symbol))

    # Check if data already exists in DB
    existing = (await db.execute(
        select(func.count(DocumentChunk.id)).where(DocumentChunk.ticker == ticker_symbol)
    )).scalar()

    if existing > 0:
        latest_filing = (await db.execute(
            select(func.max(DocumentChunk.filing_date)).where(DocumentChunk.ticker == ticker_symbol)
        )).scalar()
        # Pre-cache structured financials so LLM routes only read from DB
        await get_or_fetch_financials(ticker_symbol, db, latest_filing)
        domain = await domain_task
        return {
            "status": "exists",
            "ticker": ticker_symbol,
            "chunks": existing,
            "latest_filing_date": str(latest_filing) if latest_filing else None,
            "domain": domain,
        }

    # Run SEC ingestion (blocking I/O, offload to thread)
    await asyncio.to_thread(add_clean_fillings_to_database, ticker_symbol)

    # Check if ingestion actually produced data
    new_count = (await db.execute(
        select(func.count(DocumentChunk.id)).where(DocumentChunk.ticker == ticker_symbol)
    )).scalar()

    if new_count == 0:
        # SEC found nothing — try Yahoo Finance for non-US stocks
        yahoo_data = await asyncio.to_thread(get_yahoo_financials, ticker_symbol)
        if yahoo_data:
            filing_date = date.today()
            new_row = FinancialStatements(
                ticker=ticker_symbol,
                financial_data=yahoo_data,
                latest_filing_date=filing_date,
            )
            db.add(new_row)
            await db.commit()
            domain = await domain_task
            return {
                "status": "ingested",
                "ticker": ticker_symbol,
                "chunks": 0,
                "latest_filing_date": str(filing_date),
                "source": "yahoo",
                "domain": domain,
            }

        domain = await domain_task
        return {
            "status": "not_found",
            "ticker": ticker_symbol,
            "chunks": 0,
            "latest_filing_date": None,
            "message": f"No SEC filings found for '{ticker_symbol}'. It may not be a US-listed company.",
            "domain": domain,
        }

    latest_filing = (await db.execute(
        select(func.max(DocumentChunk.filing_date)).where(DocumentChunk.ticker == ticker_symbol)
    )).scalar()
    # Pre-cache structured financials so LLM routes only read from DB
    await get_or_fetch_financials(ticker_symbol, db, latest_filing)
    domain = await domain_task
    return {
        "status": "ingested",
        "ticker": ticker_symbol,
        "chunks": new_count,
        "latest_filing_date": str(latest_filing) if latest_filing else None,
        "domain": domain,
    }
