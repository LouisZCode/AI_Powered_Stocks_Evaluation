# test by:   uvicorn main:app --reload

from agents.agents import AVAILABLE_MODELS
from database.orm import DocumentChunk
from fastapi import FastAPI, Depends, HTTPException

from pydantic import BaseModel
from agents import create_financial_agent

from database import get_db, add_clean_fillings_to_database

import asyncio
import time

from sqlalchemy.orm import Session

from logs import start_new_log, log_llm_conversation, log_llm_timing 

app = FastAPI()

@app.get("/health/")
def health():
    return {"health" : "OK"}

@app.get("/models/")
async def show_available_models():
    return {"available_models" : list(AVAILABLE_MODELS.keys())}

class EvalRequest(BaseModel):
    models : list[str]

@app.post("/financials/{ticker_symbol}")
async def evaluate_financials(ticker_symbol : str, request : EvalRequest, db : Session = Depends(get_db)):
    # Start log
    start_new_log(ticker_symbol)

    ticker = db.query(DocumentChunk).filter_by(ticker=ticker_symbol).all()
    if not ticker:
        await asyncio.to_thread(add_clean_fillings_to_database, ticker_symbol)

    # Run selected models in parallel                                                                                                                                                                                                            
    async def run_model(model_name: str):
        try:                                                                                                                                                                                                        
            agent = create_financial_agent(model_name)
                                                                                                                                                                                                
            start_time = time.time()                                                                                                                                                                                                                 
            response = await agent.ainvoke({"messages": {"role": "user", "content": ticker_symbol}})                                                                                                                                                 
            elapsed = time.time() - start_time                                                                                                                                                                                                       
            log_llm_conversation(model_name, response)                                                                                                                                                                                               
            log_llm_timing(elapsed)

            return model_name, response["structured_response"]     

        except ValueError:
            raise HTTPException(status_code=500, detail=f"Please select a model to do the evaluation of {ticker_symbol}")                                                                                                                                                                                 
                                                                                                                                                                                                                                                
    tasks = [run_model(m) for m in request.models]                                                                                                                                                                                               
    results = await asyncio.gather(*tasks, return_exceptions=True)                                                                                                                                                                                                       
                                                                                                                                                                                                                                                
    evaluations = {}                                                                                                                                                                                                                                 
    for result in results:                                                                                                                                                                                                                           
        if isinstance(result, Exception):                                                                                                                                                                                                                                                                  
            continue                                                                                                                                                                                                                                 
        model_name, response = result                                                                                                                                                                                                                
        evaluations[model_name] = response                                                                                                                                                                                                           
                                                                                                                                                                                                                                                    
    return {"evaluations": evaluations} 