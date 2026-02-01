from fastapi import FastAPI

from agents import grok_agent

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}


@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str):
    response = await grok_agent.ainvoke(ticker_symbol)
    return {"financial_evaluation" : response}