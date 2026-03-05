from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database.connection import get_db
from database.orm import Watchlist, LLMFinancialAnalysis
from dependencies.oauth import get_current_user

router = APIRouter(prefix="/watchlist")


class WatchlistRequest(BaseModel):
    ticker: str


@router.post("/add")
async def add_to_watchlist(
    request: WatchlistRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    ticker = request.ticker.upper().strip()

    existing = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == user.id,
            Watchlist.ticker == ticker,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{ticker} is already in your watchlist")

    entry = Watchlist(user_id=user.id, ticker=ticker)
    db.add(entry)
    await db.commit()

    return {"ticker": ticker, "message": f"{ticker} added to watchlist"}


@router.delete("/remove")
async def remove_from_watchlist(
    request: WatchlistRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    ticker = request.ticker.upper().strip()

    result = await db.execute(
        delete(Watchlist).where(
            Watchlist.user_id == user.id,
            Watchlist.ticker == ticker,
        )
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"{ticker} not found in your watchlist")

    await db.commit()
    return {"ticker": ticker, "message": f"{ticker} removed from watchlist"}


@router.get("/")
async def get_watchlist(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get user's bookmarked tickers
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.user_id == user.id)
        .order_by(Watchlist.added_at.desc())
    )
    entries = result.scalars().all()

    if not entries:
        return []

    # Get latest analysis for each ticker (all models)
    tickers = [e.ticker for e in entries]
    analysis_result = await db.execute(
        select(LLMFinancialAnalysis)
        .where(LLMFinancialAnalysis.ticker.in_(tickers))
    )
    analyses = analysis_result.scalars().all()

    # Group analyses by ticker
    analysis_map: dict[str, list[dict]] = {}
    for a in analyses:
        analysis_map.setdefault(a.ticker, []).append({
            "llm_model": a.llm_model,
            "analysis": a.analysis,
            "latest_filing_date": str(a.latest_filing_date) if a.latest_filing_date else None,
        })

    return [
        {
            "ticker": e.ticker,
            "added_at": e.added_at.isoformat(),
            "analyses": analysis_map.get(e.ticker),  # None if no analysis run
        }
        for e in entries
    ]
