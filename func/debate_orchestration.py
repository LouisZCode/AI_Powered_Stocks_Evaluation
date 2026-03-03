import asyncio
import re
from collections import Counter

from agents.agents import create_debate_agent, load_prompts
from agents.openrouter_agents import (
    create_openrouter_debate_agent,
    create_openrouter_summary_model,
    is_openrouter_available,
)
from logs import extract_usage_from_response, log_llm_cost, log_cost_summary, log_debate_compression

prompts = load_prompts()
DEBATE_ROUND1 = prompts["DEBATE_ROUND1"]
DEBATE_REVIEW = prompts["DEBATE_REVIEW"]
DEBATE_FINAL = prompts["DEBATE_FINAL"]
DEBATE_SUMMARY = prompts["DEBATE_SUMMARY"]

VALID_RATINGS = {'excellent', 'good', 'neutral', 'bad', 'horrible'}
COMPRESSION_WINDOW = 1
AGENT_TIMEOUT = 150  # seconds – matches analysis route


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

    # Create debate agents: direct (always) + OpenRouter per-metric (for label)
    debate_agents = {}
    use_openrouter = is_openrouter_available()

    for model_name in analysis_dicts.keys():
        debate_agents[model_name] = create_debate_agent(model_name)

    for metric in metrics_to_debate:
        # Create per-metric OpenRouter agents with label
        or_debate_agents = {}
        if use_openrouter:
            for model_name in analysis_dicts.keys():
                try:
                    or_debate_agents[model_name] = create_openrouter_debate_agent(
                        model_name,
                        action_label=f"Agora | debate | {metric}",
                    )
                except ValueError:
                    or_debate_agents[model_name] = None

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
    if log_file:
        with open(log_file, "a") as f:
            f.write(f"\n── Round 1: {metric} ──\n")
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
            cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "reasoning_tokens": usage_info.get("reasoning_tokens", 0), "cost": usage_info.get("cost", 0)})
            if log_file:
                log_llm_cost(model_name, log_file, usage_info, provider=usage_info.get("provider", ""), action=f"debate-r1-{metric}")
        positions[model_name]['history'].append(response)
        transcript.append({
            'round': 1, 'metric': metric,
            'llm': model_name, 'content': response
        })
    # Rounds 2 to N: Review and respond (parallel per round)
    compressed_summary = None
    last_compressed_up_to = 0
    for round_num in range(2, max_rounds + 1):
        if log_file:
            with open(log_file, "a") as f:
                f.write(f"\n── Round {round_num}: {metric} ──\n")

        # Compress old rounds when history exceeds the sliding window
        rounds_completed = round_num - 1
        compress_up_to = rounds_completed - COMPRESSION_WINDOW
        if compress_up_to >= 2 and compress_up_to > last_compressed_up_to:
            compressed_summary, summary_cost = await _compress_history(
                positions, metric, ticker, failed_models,
                compress_up_to, log_file=log_file,
                triggered_by=f"before R{round_num}",
            )
            if summary_cost:
                cost_entries.append(summary_cost)
                if log_file:
                    inp = summary_cost.get("input_tokens", 0)
                    out = summary_cost.get("output_tokens", 0)
                    kept_start = compress_up_to + 1
                    kept_str = f"R{kept_start}" if kept_start == rounds_completed else f"R{kept_start}..R{rounds_completed}"
                    with open(log_file, "a") as f:
                        f.write(f"  ⟳ compressed rounds 1..{compress_up_to}, keeping {kept_str} verbatim ({inp:,} in / {out:,} out)\n\n")
            last_compressed_up_to = compress_up_to

        review_tasks = []
        for model_name, agent in debate_agents.items():
            if model_name in failed_models:
                continue
            other_positions = _format_other_positions_windowed(
                positions, model_name, compressed_summary,
                COMPRESSION_WINDOW, failed_models,
            )
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
                cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "reasoning_tokens": usage_info.get("reasoning_tokens", 0), "cost": usage_info.get("cost", 0)})
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

    # Re-compress before Final if new rounds fell outside the window
    compress_up_to_final = max_rounds - COMPRESSION_WINDOW
    if compress_up_to_final >= 2 and compress_up_to_final > last_compressed_up_to:
        compressed_summary, summary_cost = await _compress_history(
            positions, metric, ticker, failed_models,
            compress_up_to_final, log_file=log_file,
            triggered_by="before Final",
        )
        if summary_cost:
            cost_entries.append(summary_cost)

    # Final round: Commit to stance (parallel)
    if log_file:
        with open(log_file, "a") as f:
            f.write(f"\n── Final: {metric} ──\n")
            if compressed_summary:
                kept_start = compress_up_to_final + 1
                kept_str = f"R{kept_start}" if kept_start == max_rounds else f"R{kept_start}..R{max_rounds}"
                f.write(f"  ⟳ using summary of rounds 1..{compress_up_to_final}, {kept_str} verbatim\n\n")
    final_tasks = []
    for model_name, agent in debate_agents.items():
        if model_name in failed_models:
            continue
        history_summary = _format_history_with_window(
            positions, compressed_summary, COMPRESSION_WINDOW, failed_models
        )
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
            cost_entries.append({"model_name": model_name, "provider": usage_info.get("provider", ""), "input_tokens": usage_info.get("input_tokens", 0), "output_tokens": usage_info.get("output_tokens", 0), "reasoning_tokens": usage_info.get("reasoning_tokens", 0), "cost": usage_info.get("cost", 0)})
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
            response = await asyncio.wait_for(
                current_agent.ainvoke(
                    {"messages": [{"role": "user", "content": prompt}]}
                ),
                timeout=AGENT_TIMEOUT,
            )
            usage_info = extract_usage_from_response(response)
            usage_info["provider"] = tag
            messages = response.get("messages", [])
            for msg in reversed(messages):
                if hasattr(msg, 'content') and msg.content:
                    return (model_name, msg.content, usage_info)
            return (model_name, "", usage_info)
        except asyncio.TimeoutError:
            print(f"[DEBATE] {model_name} timed out via {tag}")
            continue
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


def _format_other_positions_windowed(
    positions: dict, exclude_model: str,
    compressed_summary: str | None,
    window_size: int, failed_models: set,
) -> str:
    """Format other models' positions with compressed old rounds + recent verbatim."""
    if not compressed_summary:
        return _format_other_positions(positions, exclude_model, failed_models)

    # Recent rounds only (within window) — verbatim per model
    recent_lines = []
    for model_name, pos in positions.items():
        if model_name == exclude_model or model_name in failed_models:
            continue
        recent_entries = pos['history'][-window_size:]
        if recent_entries:
            recent_lines.append(f"{model_name} (current: {pos['rating']})")
            start_round = len(pos['history']) - len(recent_entries) + 1
            for i, entry in enumerate(recent_entries):
                recent_lines.append(f"  Round {start_round + i}: {entry}")

    return (
        f"Summary of earlier rounds:\n{compressed_summary}\n\n"
        f"Recent positions:\n" + "\n".join(recent_lines)
    )


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


async def _compress_history(
    positions: dict, metric: str, ticker: str,
    failed_models: set, compress_up_to: int,
    log_file: str = None, triggered_by: str = "",
) -> tuple[str, dict]:
    """Compress rounds 1..compress_up_to into a summary table via a cheap LLM call."""
    lines = []
    for model_name, pos in positions.items():
        if model_name in failed_models:
            continue
        lines.append(f"{model_name} (current: {pos['rating']})")
        for i, entry in enumerate(pos['history'][:compress_up_to]):
            lines.append(f"  Round {i+1}: {entry}")
    history_text = "\n".join(lines)

    prompt = DEBATE_SUMMARY.format(
        metric=metric, ticker=ticker, history=history_text
    )

    try:
        summary_model = create_openrouter_summary_model(
            action_label=f"Agora | summary | {metric}"
        )
        response = await summary_model.ainvoke(prompt)
        usage_info = {}
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            um = response.usage_metadata
            meta = getattr(response, "response_metadata", {}) or {}
            token_usage = meta.get("token_usage", {}) or {}
            cost = token_usage.get("cost", 0) or meta.get("cost", 0)
            usage_info = {
                "input_tokens": um.get("input_tokens", 0),
                "output_tokens": um.get("output_tokens", 0),
                "reasoning_tokens": 0,
                "cost": float(cost) if cost else 0,
                "provider": "openrouter",
            }
        cost_entry = {
            "model_name": "mistral_fast",
            "provider": "openrouter",
            "input_tokens": usage_info.get("input_tokens", 0),
            "output_tokens": usage_info.get("output_tokens", 0),
            "reasoning_tokens": 0,
            "cost": usage_info.get("cost", 0),
        }
        if log_file and usage_info:
            log_llm_cost("mistral_fast", log_file, usage_info,
                         provider="openrouter", action=f"debate-summarize-{metric}")
        if log_file:
            log_debate_compression(
                log_file, metric, compress_up_to,
                response.content, cost_entry,
                triggered_by=triggered_by,
            )
        return response.content, cost_entry
    except Exception as e:
        print(f"[DEBATE] Summary compression failed: {e}, using full history")
        return "\n".join(lines), {}


def _format_history_with_window(
    positions: dict, compressed_summary: str | None,
    window_size: int, failed_models: set,
) -> str:
    """Format history using compressed summary for old rounds + verbatim recent rounds."""
    if not compressed_summary:
        return _format_history_summary(positions, failed_models)

    recent_lines = []
    for model_name, pos in positions.items():
        if model_name in failed_models:
            continue
        recent_entries = pos['history'][-window_size:]
        if recent_entries:
            recent_lines.append(f"{model_name} (current: {pos['rating']})")
            start_round = len(pos['history']) - len(recent_entries) + 1
            for i, entry in enumerate(recent_entries):
                recent_lines.append(f"  Round {start_round + i}: {entry}")

    return (
        f"Summary of earlier rounds:\n{compressed_summary}\n\n"
        f"Recent rounds (full context):\n" + "\n".join(recent_lines)
    )


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
