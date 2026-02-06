import copy

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from database import get_db
from sqlalchemy.orm import Session
from database.orm import LLMFinancialAnalysis

from pydantic import BaseModel
from sqlalchemy import and_

from reports import generate_pdf
from routes.financial_harmonization import METRICS, _get_tier, _get_majority, POSITIVE_TIER, NEGATIVE_TIER, NEUTRAL_TIER

router = APIRouter()


class ReportRequest(BaseModel):
    models: list[str]
    debate_results: dict[str, str] = {}
    position_changes: list[dict] = []
    debate_rounds: int = 0


@router.post("/report/financials/{ticker_symbol}")
async def generate_financial_report(ticker_symbol: str, request: ReportRequest, db: Session = Depends(get_db)):

    if len(request.models) < 2:
        return {"error": f"Report needs at least 2 LLMs, you only provided {len(request.models)}"}

    # Fetch cached analyses
    analyses = db.query(LLMFinancialAnalysis).filter(
        and_(
            LLMFinancialAnalysis.ticker == ticker_symbol,
            LLMFinancialAnalysis.llm_model.in_(request.models),
        )
    ).all()

    analysis_dicts = {a.llm_model: a.analysis for a in analyses}

    missing = [m for m in request.models if m not in analysis_dicts]
    if missing:
        return {"error": f"Missing analyses for: {missing}. Run /analisys/financials first."}

    # Re-run harmonization (deterministic, no cost)
    harmonize_result = _run_harmonization(analysis_dicts)

    # Build debate result from request body
    debate_result = None
    if request.debate_results:
        debate_result = {
            'debate_results': request.debate_results,
            'position_changes': request.position_changes,
        }

    # Generate PDF
    pdf_path = generate_pdf(
        ticker=ticker_symbol,
        harmonize_result=harmonize_result,
        original_analyses=analysis_dicts,
        debate_result=debate_result,
        debate_rounds=request.debate_rounds,
    )

    if not pdf_path:
        return {"error": "Report generation is temporarily unavailable. Please try again later."}

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=pdf_path.split("/")[-1],
    )


def _run_harmonization(analysis_dicts: dict[str, dict]) -> dict:
    """Re-run harmonization logic to get clear vs debated metrics."""
    model_names = list(analysis_dicts.keys())
    analysis_list = list(analysis_dicts.values())
    harmonization_log = []

    for metric in METRICS:
        ratings = []
        for analysis in analysis_list:
            raw_rating = analysis.get(metric, '')
            if not raw_rating or "not enough information" in raw_rating.lower():
                ratings.append(None)
            else:
                first_word = raw_rating.split()[0].capitalize() if raw_rating else None
                ratings.append(first_word)

        valid_ratings = [r for r in ratings if r is not None]
        if len(valid_ratings) < 2:
            harmonization_log.append({
                'metric': metric, 'action': 'skipped',
                'reason': 'insufficient_data',
                'ratings': dict(zip(model_names, ratings))
            })
            continue

        tiers = set(_get_tier(r) for r in valid_ratings)

        if len(set(r.lower() for r in valid_ratings)) == 1:
            harmonization_log.append({
                'metric': metric, 'action': 'already_aligned',
                'ratings': dict(zip(model_names, ratings)),
                'result': valid_ratings[0].capitalize()
            })
            continue

        if 'neutral' in tiers:
            harmonization_log.append({
                'metric': metric, 'action': 'debate',
                'reason': 'neutral_present',
                'ratings': dict(zip(model_names, ratings))
            })
        elif 'positive' in tiers and 'negative' in tiers:
            harmonization_log.append({
                'metric': metric, 'action': 'debate',
                'reason': 'cross_tier_conflict',
                'ratings': dict(zip(model_names, ratings))
            })
        else:
            majority = _get_majority(valid_ratings)
            harmonization_log.append({
                'metric': metric, 'action': 'harmonized',
                'original': dict(zip(model_names, ratings)),
                'result': majority
            })

    return {'harmonization_log': harmonization_log}
