import asyncio
import re
from collections import Counter

from agents.agents import create_debate_agent, load_prompts

prompts = load_prompts()
DEBATE_ROUND1 = prompts["DEBATE_ROUND1"]
DEBATE_REVIEW = prompts["DEBATE_REVIEW"]
DEBATE_FINAL = prompts["DEBATE_FINAL"]

VALID_RATINGS = {'excellent', 'good', 'neutral', 'bad', 'horrible'}


async def run_debate(
    ticker: str,
    metrics_to_debate: list[str],
    analysis_dicts: dict[str, dict],
    rounds: int = 2
) -> dict:
    """
    Run multi-round debate on disputed metrics.

    Args:
        ticker: Stock symbol
        metrics_to_debate: Metric names needing debate
        analysis_dicts: {model_name: analysis_dict} from cached analyses
        rounds: Number of debate rounds

    Returns:
        {
            'debate_results': {metric: final_rating},
            'position_changes': [{llm, metric, from, to}],
            'transcript': [{round, metric, llm, content}]
        }
    """
    debate_results = {}
    all_transcripts = []
    position_changes = []

    # Create debate agents dynamically
    debate_agents = {}
    for model_name in analysis_dicts.keys():
        debate_agents[model_name] = create_debate_agent(model_name)

    for metric in metrics_to_debate:
        result = await _debate_single_metric(
            ticker, metric, analysis_dicts, debate_agents, rounds
        )
        debate_results[metric] = result['final_rating']
        all_transcripts.extend(result['transcript'])
        position_changes.extend(result['changes'])

    return {
        'debate_results': debate_results,
        'position_changes': position_changes,
        'transcript': all_transcripts
    }


async def _debate_single_metric(
    ticker: str,
    metric: str,
    analysis_dicts: dict[str, dict],
    debate_agents: dict,
    max_rounds: int
) -> dict:
    """Debate a single metric through multiple rounds."""
    transcript = []
    changes = []

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
    round1_tasks = []
    for model_name, agent in debate_agents.items():
        prompt = DEBATE_ROUND1.format(
            metric=metric,
            ticker=ticker,
            rating=positions[model_name]['rating'],
            reason=positions[model_name]['reason']
        )
        round1_tasks.append(_invoke_agent(agent, prompt, model_name))

    round1_results = await asyncio.gather(*round1_tasks)
    for model_name, response in round1_results:
        positions[model_name]['history'].append(response)
        transcript.append({
            'round': 1, 'metric': metric,
            'llm': model_name, 'content': response
        })
    # Rounds 2 to N: Review and respond (parallel per round)
    for round_num in range(2, max_rounds + 1):
        review_tasks = []
        for model_name, agent in debate_agents.items():
            other_positions = _format_other_positions(positions, model_name)
            prompt = DEBATE_REVIEW.format(
                metric=metric,
                ticker=ticker,
                my_rating=positions[model_name]['rating'],
                my_reason=positions[model_name]['reason'],
                other_positions=other_positions
            )
            review_tasks.append(_invoke_agent(agent, prompt, model_name))

        review_results = await asyncio.gather(*review_tasks)
        for model_name, response in review_results:
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
        history_summary = _format_history_summary(positions)
        prompt = DEBATE_FINAL.format(
            metric=metric,
            ticker=ticker,
            my_rating=positions[model_name]['rating'],
            history_summary=history_summary
        )
        final_tasks.append(_invoke_agent(agent, prompt, model_name))

    final_results = await asyncio.gather(*final_tasks)
    final_ratings = []
    for model_name, response in final_results:
        final_rating = _extract_final_rating(response)
        if final_rating:
            final_ratings.append(final_rating)
        else:
            final_ratings.append(positions[model_name]['rating'])
        transcript.append({
            'round': 'final', 'metric': metric,
            'llm': model_name, 'content': response
        })

    consensus = _get_majority_rating(final_ratings)

    # Track position changes: compare initial vs final (skip if already tracked in review rounds)
    models_already_changed = {c['llm'] for c in changes if c['metric'] == metric}
    for model_name, response in final_results:
        if model_name in models_already_changed:
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
        'changes': changes
    }


# --- Helper functions ---

async def _invoke_agent(agent, prompt: str, model_name: str) -> tuple[str, str]:
    """Invoke a debate agent and return (model_name, response_text)."""
    response = await agent.ainvoke(
        {"messages": [{"role": "user", "content": prompt}]}
    )
    # Extract text content from last AI message
    messages = response.get("messages", [])
    for msg in reversed(messages):
        if hasattr(msg, 'content') and msg.content:
            return (model_name, msg.content)
    return (model_name, "")


def _format_other_positions(positions: dict, exclude_model: str) -> str:
    """Format other models' positions for the review prompt."""
    lines = []
    for model_name, pos in positions.items():
        if model_name == exclude_model:
            continue
        latest = pos['history'][-1] if pos['history'] else pos['reason']
        lines.append(f"{model_name}: {pos['rating']}\n  {latest}")
    return "\n\n".join(lines)


def _format_history_summary(positions: dict) -> str:
    """Format debate history for the final round prompt."""
    lines = []
    for model_name, pos in positions.items():
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
