from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, update

from database.connection import get_db
from database.orm import Watchlist, LLMFinancialAnalysis
from dependencies.oauth import get_current_user

router = APIRouter(prefix="/watchlist")

WATCHLIST_LIMITS = {"free": 10, "premium": 50}


class WatchlistRequest(BaseModel):
    ticker: str


class ReorderRequest(BaseModel):
    tickers: list[str]


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

    # Check watchlist limit
    count_result = await db.execute(
        select(func.count()).select_from(Watchlist).where(Watchlist.user_id == user.id)
    )
    count = count_result.scalar()
    tier = getattr(user, "tier", "free") or "free"
    limit = WATCHLIST_LIMITS.get(tier, 10)
    if count >= limit:
        raise HTTPException(status_code=403, detail=f"Watchlist limit reached ({count}/{limit}). Upgrade to add more.")

    # New entries go to the bottom (max sort_order + 1)
    max_order = await db.execute(
        select(func.coalesce(func.max(Watchlist.sort_order), -1))
        .where(Watchlist.user_id == user.id)
    )
    next_order = max_order.scalar() + 1

    entry = Watchlist(user_id=user.id, ticker=ticker, sort_order=next_order)
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


@router.put("/reorder")
async def reorder_watchlist(
    request: ReorderRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    for idx, ticker in enumerate(request.tickers):
        await db.execute(
            update(Watchlist)
            .where(Watchlist.user_id == user.id, Watchlist.ticker == ticker)
            .values(sort_order=idx)
        )
    await db.commit()
    return {"message": "Watchlist reordered"}


@router.get("/search")
async def search_analyzed_tickers(
    q: str = "",
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(func.distinct(LLMFinancialAnalysis.ticker))
        .order_by(LLMFinancialAnalysis.ticker)
        .limit(20)
    )
    if q.strip():
        query = query.where(LLMFinancialAnalysis.ticker.ilike(f"%{q.strip()}%"))
    result = await db.execute(query)
    tickers = [row[0] for row in result.all()]
    return {"tickers": tickers}


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
        .order_by(Watchlist.sort_order.asc())
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
