from fastapi import APIRouter, Depends
from database import get_db, add_clean_fillings_to_database
from database.orm import DocumentChunk
from database.financial_statements import get_or_fetch_financials
from sqlalchemy.orm import Session
from sqlalchemy import func

import asyncio

router = APIRouter()


@router.post("/ingestion/financials/{ticker_symbol}")
async def ingest_financials(ticker_symbol: str, db: Session = Depends(get_db)):
    # Check if data already exists in DB
    existing = db.query(func.count(DocumentChunk.id)).filter_by(ticker=ticker_symbol).scalar()

    if existing > 0:
        latest_filing = db.query(func.max(DocumentChunk.filing_date)).filter_by(ticker=ticker_symbol).scalar()
        # Pre-cache structured financials so LLM routes only read from DB
        await asyncio.to_thread(get_or_fetch_financials, ticker_symbol, db, latest_filing)
        return {
            "status": "exists",
            "ticker": ticker_symbol,
            "chunks": existing,
            "latest_filing_date": str(latest_filing) if latest_filing else None,
        }

    # Run SEC ingestion (blocking I/O, offload to thread)
    await asyncio.to_thread(add_clean_fillings_to_database, ticker_symbol)

    # Check if ingestion actually produced data
    new_count = db.query(func.count(DocumentChunk.id)).filter_by(ticker=ticker_symbol).scalar()

    if new_count == 0:
        return {
            "status": "not_found",
            "ticker": ticker_symbol,
            "chunks": 0,
            "latest_filing_date": None,
            "message": f"No SEC filings found for '{ticker_symbol}'. It may not be a US-listed company.",
        }

    latest_filing = db.query(func.max(DocumentChunk.filing_date)).filter_by(ticker=ticker_symbol).scalar()
    # Pre-cache structured financials so LLM routes only read from DB
    await asyncio.to_thread(get_or_fetch_financials, ticker_symbol, db, latest_filing)
    return {
        "status": "ingested",
        "ticker": ticker_symbol,
        "chunks": new_count,
        "latest_filing_date": str(latest_filing) if latest_filing else None,
    }
