import os

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

from database import retrieval_tool
from .agents import load_prompts, FinancialInformation

load_dotenv()

# ---------------------------------------------------------------------------
# OpenRouter configuration
# ---------------------------------------------------------------------------
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

OPENROUTER_AVAILABLE_MODELS = {
    "grok_fast":    "x-ai/grok-4.1-fast",
    "openai_fast":  "openai/gpt-5-mini",
    "claude_fast":  "anthropic/claude-haiku-4-5",
    "gemini_fast":  "google/gemini-2.5-flash",
    "mistral_fast": "mistralai/mistral-small-3.2-24b-instruct-2506",
    "grok_deep":    "x-ai/grok-4-07-09",
    "openai_deep":  "openai/gpt-5.1",
    "claude_deep":  "anthropic/claude-sonnet-4-5",
    "gemini_deep":  "google/gemini-2.5-pro",
    "mistral_deep": "mistralai/mistral-large-2411",
}

prompts = load_prompts()
financial_strenght_system_prompt = prompts["QUARTERLY_RESULTS_EXPERT"]
debater_system_prompt = prompts["THE_DEBATER"]


def is_openrouter_available() -> bool:
    return bool(OPENROUTER_API_KEY)


def _build_openrouter_model(model_key: str, action_label: str = "Agora") -> ChatOpenAI:
    if model_key not in OPENROUTER_AVAILABLE_MODELS:
        raise ValueError(f"Unknown OpenRouter model: {model_key}")
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set")

    return ChatOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
        model=OPENROUTER_AVAILABLE_MODELS[model_key],
        default_headers={"HTTP-Referer": action_label},
    )


def create_openrouter_financial_agent(model_key: str, action_label: str = "Agora"):
    chat_model = _build_openrouter_model(model_key, action_label)
    return create_agent(
        model=chat_model,
        system_prompt=financial_strenght_system_prompt,
        response_format=FinancialInformation,
        tools=[retrieval_tool],
    )


def create_openrouter_debate_agent(model_key: str, action_label: str = "Agora"):
    chat_model = _build_openrouter_model(model_key, action_label)
    return create_agent(
        model=chat_model,
        system_prompt=debater_system_prompt,
        tools=[],
    )
