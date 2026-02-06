from fastapi import APIRouter, Depends
from database import get_db, add_clean_fillings_to_database
from database.orm import DocumentChunk
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
    return {
        "status": "ingested",
        "ticker": ticker_symbol,
        "chunks": new_count,
        "latest_filing_date": str(latest_filing) if latest_filing else None,
    }
