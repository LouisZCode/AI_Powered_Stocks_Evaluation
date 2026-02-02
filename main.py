# test by:   uvicorn main:app --reload

from database.orm import DocumentChunk
from fastapi import FastAPI

from pydantic import BaseModel
from agents import grok_agent

from database import alchemy_engine

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}

class QueryBody(BaseModel):
    ticker : str

@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str):

    db = alchemy_engine()

    ticker = db.query(DocumentChunk).filter_by(ticker=ticker_symbol).all()
    print(f"Found in database: {ticker}")

    if not ticker:
        db.close()
        print("Not ticker found in DB")
        return("No ticker found in db")
    

    response = await grok_agent.ainvoke({"messages" : {"role" : "user" , "content" : ticker_symbol}})
    db.close()
    return {"financial_evaluation" : response["structured_response"]}