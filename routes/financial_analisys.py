from fastapi import APIRouter
from database.orm import DocumentChunk, LLMFinancialAnalysis
from fastapi import Depends, HTTPException

from pydantic import BaseModel
from agents import create_financial_agent

from database import get_db

import asyncio
import time

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from logs import start_new_log, log_llm_conversation, log_llm_timing, log_llm_start, log_llm_finish, log_cached_result
router = APIRouter()

class EvalRequest(BaseModel):
    models : list[str]

@router.post("/analisys/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str, request : EvalRequest, db : Session = Depends(get_db)):
    # Start log
    start_new_log(ticker_symbol)

    # 1. Get latest filing date for cache key
    latest_filing = db.query(func.max(DocumentChunk.filing_date)).filter_by(ticker=ticker_symbol).scalar()

    # 2. Check cache: which models already analyzed this ticker with current filing?
    cached = db.query(LLMFinancialAnalysis).filter(
        and_(
            LLMFinancialAnalysis.ticker == ticker_symbol,
            LLMFinancialAnalysis.llm_model.in_(request.models),
            LLMFinancialAnalysis.latest_filing_date == latest_filing
        )
    ).all()

    cached_results = {c.llm_model: c.analysis for c in cached}
    models_to_run = [m for m in request.models if m not in cached_results]

    # Log cached results
    for model_name, analysis in cached_results.items():
        log_cached_result(model_name, analysis)

    # 3. Run LLMs only for models not in cache
    async def run_model(model_name: str):
        try:
            agent = create_financial_agent(model_name)

            log_llm_start(model_name)
            start_time = time.time()
            response = await agent.ainvoke({"messages": {"role": "user", "content": ticker_symbol}})
            elapsed = time.time() - start_time
            log_llm_finish(model_name, elapsed)
            log_llm_conversation(model_name, response)
            log_llm_timing(elapsed)

            return model_name, response["structured_response"]

        except ValueError:
            raise HTTPException(status_code=500, detail=f"Please select a model to do the evaluation of {ticker_symbol}")

    tasks = [run_model(m) for m in models_to_run]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 4. Process fresh results and save to cache
    fresh_results = {}
    for result in results:
        if isinstance(result, Exception):
            continue
        model_name, response = result
        fresh_results[model_name] = response

        # Save to cache
        new_analysis = LLMFinancialAnalysis(
            ticker=ticker_symbol,
            llm_model=model_name,
            analysis=response,
            latest_filing_date=latest_filing
        )
        db.add(new_analysis)

    db.commit()

    # 5. Merge cached + fresh results
    evaluations = {**cached_results, **fresh_results}

    return {"evaluations": evaluations}