# test by:   uvicorn main:app --reload

from agents.agents import AVAILABLE_MODELS
from fastapi import FastAPI
from routes import all_routes

app = FastAPI()
for router in all_routes:
    app.include_router(router)

@app.get("/health/")
def health():
    return {"health" : "OK"}

@app.get("/models/")
async def show_available_models():
    return {"available_models" : list(AVAILABLE_MODELS.keys())}

