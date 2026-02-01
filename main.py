# test by:   uvicorn main:app --reload

from fastapi import FastAPI

from pydantic import BaseModel
from agents import grok_agent

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}

class QueryBody(BaseModel):
    ticker : str

@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str):
    response = await grok_agent.ainvoke({"messages" : {"role" : "user" , "content" : ticker_symbol}})
    return {"financial_evaluation" : response["structured_response"]}