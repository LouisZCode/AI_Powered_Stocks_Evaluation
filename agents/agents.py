# to test  python -m agents.agents

from langchain.agents import create_agent
from dotenv import load_dotenv

import yaml

from typing import TypedDict

from database import retrieval_tool

load_dotenv()


def load_prompts():
    """Load all prompts from prompts.yaml file"""
    with open("agents/prompts.yaml", "r", encoding="utf-8") as f:
        prompts = yaml.safe_load(f)
    return prompts

prompts = load_prompts()
financial_strenght_system_prompt = prompts["QUARTERLY_RESULTS_EXPERT"]


AVAILABLE_MODELS = {
    "grok": "xai:grok-4-fast-non-reasoning",                                                                                                                                                                                                     
    "openai": "openai:gpt-5-mini",                                                                                                                                                                                                                   
    "claude": "anthropic:claude-haiku-4-5",                                                                                                                                                                                              
    "gemini": "google_genai:gemini-2.5-flash",
    "mistral": "mistral-large-2512"                                                                                                                                                                                                         
}

class FinancialInformation(TypedDict):
    stock: str
    revenue: str
    revenue_reason: str
    net_income: str
    net_income_reason: str
    gross_margin: str
    gross_margin_reason: str
    operational_costs: str
    operational_costs_reason: str
    cash_flow: str
    cash_flow_reason: str
    quarterly_growth: str
    quarterly_growth_reason: str
    total_assets: str
    total_assets_reason: str
    total_debt: str
    total_debt_reason: str
    financial_strenght: str
    overall_summary: str

debater_system_prompt = prompts["THE_DEBATER"]


def create_financial_agent(model_key : str):
    if model_key not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown Model: {model_key}")

    return create_agent(
    model=AVAILABLE_MODELS[model_key],
    system_prompt=financial_strenght_system_prompt,
    response_format=FinancialInformation,
    tools=[retrieval_tool]
    )


def create_debate_agent(model_key: str):
    if model_key not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown Model: {model_key}")

    return create_agent(
        model=AVAILABLE_MODELS[model_key],
        system_prompt=debater_system_prompt,
        tools=[]
    )

# to test  python -m agents.agents
"""
message = input("Write your ticker here:\n")

response = grok_agent.invoke(
    {"messages" : {"role" : "user" , "content" : message}}
    )

for i , msg in enumerate(response["messages"]):
    msg.pretty_print()
"""