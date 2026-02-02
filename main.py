# test by:   uvicorn main:app --reload

from database.orm import DocumentChunk
from fastapi import FastAPI, Depends

from pydantic import BaseModel
from agents import grok_agent

from database import get_db, add_clean_fillings_to_database

import asyncio
import time

from sqlalchemy.orm import Session

from logs import start_new_log, log_llm_conversation, log_llm_timing 

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}

class QueryBody(BaseModel):
    ticker : str

@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str, db : Session = Depends(get_db)):
    # Start log for this request
    start_new_log(ticker_symbol)

    ticker = db.query(DocumentChunk).filter_by(ticker=ticker_symbol).all()

    if not ticker:
        print("Not ticker found in DB")
        await asyncio.to_thread(add_clean_fillings_to_database, ticker_symbol)

    # Time and log the LLM call
    start_time = time.time()
    response = await grok_agent.ainvoke({"messages" : {"role" : "user" , "content" : ticker_symbol}})
    elapsed = time.time() - start_time

    # Log conversation (includes tool calls + retrieved chunks)
    log_llm_conversation("grok", response)
    log_llm_timing(elapsed)

    return {"financial_evaluation" : response["structured_response"]}