# test by:   uvicorn main:app --reload

from database.orm import DocumentChunk
from fastapi import FastAPI, Depends

from pydantic import BaseModel
from agents import grok_agent

from database import get_db, add_clean_fillings_to_database

import asyncio

from sqlalchemy.orm import Session 

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}

class QueryBody(BaseModel):
    ticker : str

@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str, db : Session = Depends(get_db)):

    ticker = db.query(DocumentChunk).filter_by(ticker=ticker_symbol).all()
    print(f"Found in database: {ticker}")

    if not ticker:
        print("Not ticker found in DB")
        await asyncio.to_thread(add_clean_fillings_to_database, ticker_symbol) 
    

    response = await grok_agent.ainvoke({"messages" : {"role" : "user" , "content" : ticker_symbol}})
    return {"financial_evaluation" : response["structured_response"]}