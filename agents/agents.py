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


grok_agent = create_agent(
    model="xai:grok-4-fast-non-reasoning",
    system_prompt=financial_strenght_system_prompt,
    response_format=FinancialInformation,
    tools=[retrieval_tool]
    )

# to test  python -m agents.agents

message = input("Write your ticker here:\n")

response = grok_agent.invoke(
    {"messages" : {"role" : "user" , "content" : message}}
    )

for i , msg in enumerate(response["messages"]):
    msg.pretty_print()