from fastapi import APIRouter, Depends

from database import get_db
from sqlalchemy.orm import Session
from database.orm import LLMFinancialAnalysis

from pydantic import BaseModel
from sqlalchemy import and_

from func import run_debate
from logs import ensure_log, log_debate_transcript

router = APIRouter()


class DebateRequest(BaseModel):
    models: list[str]
    metrics: list[str]
    rounds: int = 2


@router.post("/debate/financials/{ticker_symbol}")
async def debate_financial_analysis(ticker_symbol: str, request: DebateRequest, session_id: str = None, db: Session = Depends(get_db)):

    log_file = ensure_log(f"{ticker_symbol}_debate", session_id)

    if len(request.models) < 2:
        return {"error": f"Debate needs at least 2 LLMs, you only added {request.models[0]}"}

    if not request.metrics:
        return {"error": "No metrics provided to debate"}

    # Fetch cached analyses for requested models
    analyses = db.query(LLMFinancialAnalysis).filter(
        and_(
            LLMFinancialAnalysis.ticker == ticker_symbol,
            LLMFinancialAnalysis.llm_model.in_(request.models),
        )
    ).all()

    analysis_dicts = {a.llm_model: a.analysis for a in analyses}

    missing = [m for m in request.models if m not in analysis_dicts]
    if missing:
        return {"error": f"Missing analyses for: {missing}. Run /financials first."}

    # Run debate
    result = await run_debate(
        ticker=ticker_symbol,
        metrics_to_debate=request.metrics,
        analysis_dicts=analysis_dicts,
        rounds=request.rounds
    )

    log_debate_transcript(result, log_file)

    return {
        'ticker': ticker_symbol,
        'models_used': request.models,
        'rounds': request.rounds,
        'debate_results': result['debate_results'],
        'position_changes': result['position_changes'],
        'transcript': result['transcript'],
    }
