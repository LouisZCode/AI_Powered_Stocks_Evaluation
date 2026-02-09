from fastapi import APIRouter, Depends

from database import get_db
from sqlalchemy.orm import Session
from database.orm import LLMFinancialAnalysis

from pydantic import BaseModel
from sqlalchemy import and_

import copy

from logs import ensure_log, log_harmonization

router = APIRouter()

POSITIVE_TIER = {'excellent', 'good'}   # Bullish ratings
NEGATIVE_TIER = {'bad', 'horrible'}     # Bearish ratings
NEUTRAL_TIER = {'neutral'}              # Ambiguous - always triggers debate

METRICS = [
    'revenue', 'net_income', 'gross_margin', 'operational_costs',
    'cash_flow', 'quarterly_growth', 'total_assets', 'total_debt'
]


def _get_tier(rating: str) -> str:
    """Get the tier for a rating."""
    rating_lower = rating.lower()
    if rating_lower in POSITIVE_TIER:
        return 'positive'
    elif rating_lower in NEGATIVE_TIER:
        return 'negative'
    elif rating_lower in NEUTRAL_TIER:
        return 'neutral'
    return 'unknown'


def _get_majority(ratings: list[str]) -> str:
    """Get the majority rating from a list."""
    from collections import Counter
    # Count occurrences, return most common
    counts = Counter(r.lower() for r in ratings if r)
    if counts:
        most_common = counts.most_common(1)[0][0]
        return most_common.capitalize()
    return ratings[0] if ratings else None

class EvalRequest(BaseModel):
    models : list[str]


@router.post("/harmonization/financials/{ticker_symbol}")
async def harmonize_financial_analysis(ticker_symbol : str, request : EvalRequest, session_id: str = None, db : Session = Depends(get_db)):

    log_file = ensure_log(f"{ticker_symbol}_harmonization", session_id)

    if len(request.models) < 2:
        return {"error" : f"Result harmonization need more than 2 LLMs analisys, you only added {request.models[0]}"}
    
    #Check cache: which models already analyzed this ticker?
    analyses = db.query(LLMFinancialAnalysis).filter(
        and_(
            LLMFinancialAnalysis.ticker == ticker_symbol,
            LLMFinancialAnalysis.llm_model.in_(request.models),
        )
    ).all()

    analysis_dicts = {a.llm_model: a.analysis for a in analyses}

    missing = [m for m in request.models if m not in analysis_dicts]
    if missing:
        return {"error": f"Missing analyses for: {missing}"}

    model_names = list(analysis_dicts.keys())
    analysis_list = list(analysis_dicts.values())

    harmonized = copy.deepcopy(analysis_list)
    metrics_to_debate = []
    harmonization_log = []

    for metric in METRICS:
        # Collect ratings for this metric
        ratings = []

        for analysis in analysis_list:
            raw_rating = analysis.get(metric, '')
            if not raw_rating or "not enough information" in raw_rating.lower():
                ratings.append(None)
            else:
                first_word = raw_rating.split()[0].capitalize() if raw_rating else None
                ratings.append(first_word)

        # Skip if insufficient data
        valid_ratings = [r for r in ratings if r is not None]
        if len(valid_ratings) < 2:
            harmonization_log.append({
                'metric': metric,
                'action': 'skipped',
                'reason': 'insufficient_data',
                'ratings': dict(zip(model_names, ratings))
            })
            continue

        # Get tiers for each rating
        tiers = set(_get_tier(r) for r in valid_ratings)

        # Check for unanimous agreement FIRST (even if all Neutral)
        if len(set(r.lower() for r in valid_ratings)) == 1:
            harmonization_log.append({
                'metric': metric,
                'action': 'already_aligned',
                'ratings': dict(zip(model_names, ratings)),
                'result': valid_ratings[0].capitalize()
            })
            continue

        # Check for debate triggers
        if 'neutral' in tiers:
            metrics_to_debate.append(metric)
            harmonization_log.append({
                'metric': metric,
                'action': 'debate',
                'reason': 'neutral_present',
                'ratings': dict(zip(model_names, ratings))
            })
        elif 'positive' in tiers and 'negative' in tiers:
            metrics_to_debate.append(metric)
            harmonization_log.append({
                'metric': metric,
                'action': 'debate',
                'reason': 'cross_tier_conflict',
                'ratings': dict(zip(model_names, ratings))
            })
        else:
            # All same tier but different values - harmonize to majority
            majority = _get_majority(valid_ratings)
            original_ratings = ratings.copy()

            for i in range(len(harmonized)):
                if ratings[i] is not None:
                    harmonized[i][metric] = majority
                    reason_key = f"{metric}_reason"
                    original_reason = harmonized[i].get(reason_key, '')
                    if original_reason and 'Harmonized' not in original_reason:
                        harmonized[i][reason_key] = f"{original_reason} [Harmonized to {majority}]"

            harmonization_log.append({
                'metric': metric,
                'action': 'harmonized',
                'original': dict(zip(model_names, original_ratings)),
                'result': majority
            })

    result = {
        'ticker': ticker_symbol,
        'models_used': model_names,
        'metrics_to_debate': metrics_to_debate,
        'harmonization_log': harmonization_log,
        'summary': {
            'total_metrics': len(METRICS),
            'already_aligned': sum(1 for l in harmonization_log if l['action'] == 'already_aligned'),
            'harmonized': sum(1 for l in harmonization_log if l['action'] == 'harmonized'),
            'needs_debate': len(metrics_to_debate)
        }
    }

    log_harmonization(result, log_file)

    return result