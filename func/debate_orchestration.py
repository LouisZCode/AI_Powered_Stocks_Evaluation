import asyncio
import re
from collections import Counter

from agents.agents import create_debate_agent, load_prompts
from agents.openrouter_agents import create_openrouter_debate_agent, is_openrouter_available
from logs import extract_usage_from_response, log_llm_cost, log_cost_summary

prompts = load_prompts()
DEBATE_ROUND1 = prompts["DEBATE_ROUND1"]
DEBATE_REVIEW = prompts["DEBATE_REVIEW"]
DEBATE_FINAL = prompts["DEBATE_FINAL"]

VALID_RATINGS = {'excellent', 'good', 'neutral', 'bad', 'horrible'}


async def run_debate(
    ticker: str,
    metrics_to_debate: list[str],
    analysis_dicts: dict[str, dict],
    rounds: int = 2,
    log_file: str = None,
) -> dict:
    """
    Run multi-round debate on disputed metrics.

    Args:
        ticker: Stock symbol
        metrics_to_debate: Metric names needing debate
        analysis_dicts: {model_name: analysis_dict} from cached analyses
        rounds: Number of debate rounds
        log_file: Optional log file path for cost tracking

    Returns:
        {
            'debate_results': {metric: final_rating},
            'position_changes': [{llm, metric, from, to}],
            'transcript': [{round, metric, llm, content}],
            'cost_entries': [{model_name, provider, input_tokens, output_tokens, cost}]
        }
    """
    debate_results = {}
    all_transcripts = []
    position_changes = []
    all_cost_entries = []

    # Create debate agents: OpenRouter (primary) + direct (fallback)
    debate_agents = {}
    or_debate_agents = {}
    use_openrouter = is_openrouter_available()

    for model_name in analysis_dicts.keys():
        debate_agents[model_name] = create_debate_agent(model_name)
        if use_openrouter:
            try:
                or_debate_agents[model_name] = create_openrouter_debate_agent(model_name)
            except ValueError:
                or_debate_agents[model_name] = None
        else:
            or_debate_agents[model_name] = None

    for metric in metrics_to_debate:
        result = await _debate_single_metric(
            ticker, metric, analysis_dicts, debate_agents, rounds,
            or_debate_agents=or_debate_agents,
            log_file=log_file,
        )
        debate_results[metric] = result['final_rating']
        all_transcripts.extend(result['transcript'])
        position_changes.extend(result['changes'])
        all_cost_entries.extend(result.get('cost_entries', []))

    if log_file and all_cost_entries:
        log_cost_summary(log_file, all_cost_entries, label="Debate")

    return {
        'debate_results': debate_results,
        'position_changes': position_changes,
        'transcript': all_transcripts,
        'cost_entries': all_cost_entries,
    }


async def _debate_single_metric(
    ticker: str,
    metric: str,
    analysis_dicts: dict[str, dict],
    debate_agents: dict,
    max_rounds: int,
    or_debate_agents: dict | None = None,
    log_file: str = None,
) -> dict:
    """Debate a single metric through multiple rounds."""
    transcript = []
    changes = []
    cost_entries = []
    failed_models: set[str] = set()

    # Initialize positions from cached analyses
    positions = {}
    initial_ratings = {}
    for model_name, analysis in analysis_dicts.items():
        rating = analysis.get(metric, 'Unknown')
        positions[model_name] = {
            'rating': rating,
            'reason': analysis.get(f'{metric}_reason', 'No reason provided'),
            'history': []
        }
        initial_ratings[model_name] = rating

    # Round 1: State positions (parallel)
    or_agents = or_debate_agents or {}
    round1_tasks = []
    for model_name, agent in debate_agents.items():
        prompt = DEBATE_ROUND1.format(
            metric=metric,
            ticker=ticker,
            rating=positions[model_name]['rating'],
            reason=positions[model_name]['reason']
        )
        round1_tasks.append(_invoke_agent(
            or_agents.get(model_name), prompt, model_name,
            fallback_agent=agent,
        ))

    round1_results = await asyncio.gather(*round1_tasks)
    for model_name, response, usage_info in round1_results:
        if response is None:
            failed_models.add(model_name)
            continue
        if usage_info:
            cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "cost": usage_info.get("cost", 0)})
            if log_file:
                log_llm_cost(model_name, log_file, usage_info, provider=usage_info.get("provider", ""), action=f"debate-r1-{metric}")
        positions[model_name]['history'].append(response)
        transcript.append({
            'round': 1, 'metric': metric,
            'llm': model_name, 'content': response
        })
    # Rounds 2 to N: Review and respond (parallel per round)
    for round_num in range(2, max_rounds + 1):
        review_tasks = []
        for model_name, agent in debate_agents.items():
            if model_name in failed_models:
                continue
            other_positions = _format_other_positions(positions, model_name, failed_models)
            prompt = DEBATE_REVIEW.format(
                metric=metric,
                ticker=ticker,
                my_rating=positions[model_name]['rating'],
                my_reason=positions[model_name]['reason'],
                other_positions=other_positions
            )
            review_tasks.append(_invoke_agent(
                or_agents.get(model_name), prompt, model_name,
                fallback_agent=agent,
            ))

        review_results = await asyncio.gather(*review_tasks)
        for model_name, response, usage_info in review_results:
            if response is None:
                failed_models.add(model_name)
                continue
            if usage_info:
                cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "cost": usage_info.get("cost", 0)})
                if log_file:
                    log_llm_cost(model_name, log_file, usage_info, provider=usage_info.get("provider", ""), action=f"debate-r{round_num}-{metric}")
            old_rating = positions[model_name]['rating']
            new_rating = _extract_updated_rating(response)
            if new_rating and new_rating.lower() != old_rating.lower():
                changes.append({
                    'llm': model_name, 'metric': metric,
                    'from': old_rating, 'to': new_rating
                })
                positions[model_name]['rating'] = new_rating
            positions[model_name]['history'].append(response)
            transcript.append({
                'round': round_num, 'metric': metric,
                'llm': model_name, 'content': response
            })

    # Final round: Commit to stance (parallel)
    final_tasks = []
    for model_name, agent in debate_agents.items():
        if model_name in failed_models:
            continue
        history_summary = _format_history_summary(positions, failed_models)
        prompt = DEBATE_FINAL.format(
            metric=metric,
            ticker=ticker,
            my_rating=positions[model_name]['rating'],
            history_summary=history_summary
        )
        final_tasks.append(_invoke_agent(
            or_agents.get(model_name), prompt, model_name,
            fallback_agent=agent,
        ))

    final_results = await asyncio.gather(*final_tasks)
    final_ratings = []
    for model_name, response, usage_info in final_results:
        if response is None:
            failed_models.add(model_name)
            continue
        if usage_info:
            cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "cost": usage_info.get("cost", 0)})
            if log_file:
                log_llm_cost(model_name, log_file, usage_info, provider=usage_info.get("provider", ""), action=f"debate-final-{metric}")
        final_rating = _extract_final_rating(response)
        if final_rating:
            final_ratings.append(final_rating)
        else:
            final_ratings.append(positions[model_name]['rating'])
        transcript.append({
            'round': 'final', 'metric': metric,
            'llm': model_name, 'content': response
        })

    # Failed models contribute their last known rating to consensus
    for model_name in failed_models:
        final_ratings.append(positions[model_name]['rating'])

    consensus = _get_majority_rating(final_ratings)

    # Track NET position changes: compare initial vs final for all models
    # This replaces any intermediate review-round changes with the true net result
    changes = []
    for model_name, response, _usage in final_results:
        if response is None:
            continue
        final_rating = _extract_final_rating(response) or positions[model_name]['rating']
        initial = initial_ratings[model_name]
        if final_rating.lower() != initial.lower():
            changes.append({
                'llm': model_name, 'metric': metric,
                'from': initial, 'to': final_rating
            })

    return {
        'final_rating': consensus,
        'transcript': transcript,
        'changes': changes,
        'cost_entries': cost_entries,
    }


# --- Helper functions ---

async def _invoke_agent(
    agent, prompt: str, model_name: str, fallback_agent=None
) -> tuple[str, str | None, dict]:
    """Invoke a debate agent with optional fallback.
    Returns (model_name, response_text, usage_info) or (model_name, None, {}) on failure."""
    for current_agent, tag in [(agent, "openrouter"), (fallback_agent, "direct")]:
        if current_agent is None:
            continue
        try:
            response = await current_agent.ainvoke(
                {"messages": [{"role": "user", "content": prompt}]}
            )
            usage_info = extract_usage_from_response(response)
            usage_info["provider"] = tag
            messages = response.get("messages", [])
            for msg in reversed(messages):
                if hasattr(msg, 'content') and msg.content:
                    print(f"[DEBATE] {model_name} succeeded via {tag}")
                    return (model_name, msg.content, usage_info)
            return (model_name, "", usage_info)
        except Exception as e:
            print(f"[DEBATE] {model_name} failed via {tag}: {e}")
            continue

    return (model_name, None, {})


def _format_other_positions(positions: dict, exclude_model: str, failed_models: set = frozenset()) -> str:
    """Format other models' positions for the review prompt."""
    lines = []
    for model_name, pos in positions.items():
        if model_name == exclude_model or model_name in failed_models:
            continue
        latest = pos['history'][-1] if pos['history'] else pos['reason']
        lines.append(f"{model_name}: {pos['rating']}\n  {latest}")
    return "\n\n".join(lines)


def _format_history_summary(positions: dict, failed_models: set = frozenset()) -> str:
    """Format debate history for the final round prompt."""
    lines = []
    for model_name, pos in positions.items():
        if model_name in failed_models:
            continue
        lines.append(f"{model_name} (current: {pos['rating']})")
        for i, entry in enumerate(pos['history']):
            lines.append(f"  Round {i+1}: {entry}")
    return "\n".join(lines)


def _extract_updated_rating(response: str) -> str | None:
    """Extract 'UPDATED RATING: X' from review response."""
    match = re.search(r'UPDATED RATING:\s*(\w+)', response, re.IGNORECASE)
    if match and match.group(1).lower() in VALID_RATINGS:
        return match.group(1).capitalize()
    return None


def _extract_final_rating(response: str) -> str | None:
    """Extract 'FINAL RATING: X' from final response."""
    match = re.search(r'FINAL RATING:\s*(\w+)', response, re.IGNORECASE)
    if match and match.group(1).lower() in VALID_RATINGS:
        return match.group(1).capitalize()
    return None


def _get_majority_rating(ratings: list[str]) -> str:
    """Get majority rating or 'COMPLEX' if no majority."""
    counts = Counter(r.lower() for r in ratings if r)
    if not counts:
        return "COMPLEX"
    most_common, count = counts.most_common(1)[0]
    if count > len(ratings) / 2:
        return most_common.capitalize()
    return "COMPLEX"
