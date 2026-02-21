from fastapi import APIRouter, Request, Response
from database.orm import DocumentChunk, LLMFinancialAnalysis, FinancialStatements
from fastapi import Depends, HTTPException

from pydantic import BaseModel
from agents import create_financial_agent

from database import get_db
from database.financial_statements import get_cached_financials

import asyncio
import time

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from logs import ensure_log, log_llm_conversation, log_llm_timing, log_llm_start, log_llm_finish, log_cached_result, log_llm_retry, log_llm_error, log_data_source
router = APIRouter()

class EvalRequest(BaseModel):
    models : list[str]

@router.post("/analisys/financials/{ticker_symbol}")
async def evaluate_financials(
    ticker_symbol : str,
    request : EvalRequest,
    cookie_request : Request,
    cookie_response : Response,
    session_id: str = None,
    db : Session = Depends(get_db)
    ):

    raw_cookie = cookie_request.cookies.get("agora_session")

    if not raw_cookie:
        count = 1
    else:
        try:
            count = int(raw_cookie) + 1
        except (ValueError, TypeError):
            count = 1
    
    if count > 3:
        raise HTTPException(status_code=429, detail="You ran out of free analisys, please signup before continuing")


    # Start log
    log_file = ensure_log(ticker_symbol, session_id)

    latest_filing = db.query(func.max(DocumentChunk.filing_date)).filter_by(ticker=ticker_symbol).scalar()

    if latest_filing is not None:
        data_source = "SEC"
    else:
        # No SEC chunks — check if Yahoo data exists in financial_statements cache
        latest_filing = db.query(func.max(FinancialStatements.latest_filing_date)).filter_by(ticker=ticker_symbol).scalar()
        data_source = "Yahoo" if latest_filing is not None else "None"

    log_data_source(ticker_symbol, log_file, data_source)

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
        log_cached_result(model_name, log_file, analysis)

    financial_context = await asyncio.to_thread(get_cached_financials, ticker_symbol, db, latest_filing)

    user_message = ticker_symbol
    if financial_context:
        user_message = f"{ticker_symbol}\n\n{financial_context}"

    MAX_ATTEMPTS = 3
    TIMEOUT_SECONDS = 120
    BACKOFF_SECONDS = [2, 4]  # wait times between retries

    async def run_model(model_name: str):
        try:
            agent = create_financial_agent(model_name)
        except ValueError:
            raise HTTPException(status_code=500, detail=f"Unknown model: {model_name}")

        last_error = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                log_llm_start(model_name, log_file)
                start_time = time.time()
                response = await asyncio.wait_for(
                    agent.ainvoke({"messages": {"role": "user", "content": user_message}}),
                    timeout=TIMEOUT_SECONDS,
                )
                elapsed = time.time() - start_time
                log_llm_finish(model_name, log_file, elapsed)
                log_llm_conversation(model_name, log_file, response)
                log_llm_timing(log_file, elapsed)

                return model_name, response["structured_response"]

            except asyncio.TimeoutError:
                last_error = f"Timed out after {TIMEOUT_SECONDS}s"
            except Exception as e:
                last_error = str(e)

            # If retries remain, log and wait
            if attempt < MAX_ATTEMPTS:
                wait = BACKOFF_SECONDS[attempt - 1]
                log_llm_retry(model_name, log_file, attempt, MAX_ATTEMPTS, last_error, wait)
                await asyncio.sleep(wait)

        # All retries exhausted
        error_detail = f"{model_name} failed after {MAX_ATTEMPTS} attempts: {last_error}"
        log_llm_error(model_name, log_file, last_error)
        raise HTTPException(status_code=504, detail=error_detail)

    tasks = [run_model(m) for m in models_to_run]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fresh_results = {}
    errors = []
    for result in results:
        if isinstance(result, Exception):
            errors.append(result)
            continue
        model_name, response = result
        fresh_results[model_name] = response

    if not fresh_results and not cached_results and errors:
        first = errors[0]
        if isinstance(first, HTTPException):
            raise first
        raise HTTPException(status_code=500, detail=str(first))

    # Save fresh results to cache
    for model_name, response in fresh_results.items():
        new_analysis = LLMFinancialAnalysis(
            ticker=ticker_symbol,
            llm_model=model_name,
            analysis=response,
            latest_filing_date=latest_filing
        )
        db.add(new_analysis)

    db.commit()

    cookie_response.set_cookie(
        key="agora_session",
        value=str(count),
        httponly=True,
        max_age=60 * 60 * 24 * 30,
        samesite="lax"
    )

    # 5. Merge cached + fresh results
    evaluations = {**cached_results, **fresh_results}

    return {"evaluations": evaluations}