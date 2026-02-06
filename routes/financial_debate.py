from fastapi import APIRouter, Depends

from database import get_db
from sqlalchemy.orm import Session
from database.orm import LLMFinancialAnalysis

from pydantic import BaseModel
from sqlalchemy import and_

import asyncio

router = APIRouter()


class DebateRequest(BaseModel):
    models: list[str]
    metrics: list[str]
    rounds: int = 2


@router.post("/debate/financials/{ticker_symbol}")
async def debate_financial_analysis(ticker_symbol: str, request: DebateRequest, db: Session = Depends(get_db)):
    # TODO: your debate logic here
    pass
