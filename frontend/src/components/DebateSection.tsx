"use client";

import { useState, useMemo, useEffect } from "react";
import type { DebateResponse, DebateTranscriptEntry } from "@/lib/types";

const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  net_income: "Net Income",
  gross_margin: "Gross Margin",
  operational_costs: "Op. Costs",
  cash_flow: "Cash Flow",
  quarterly_growth: "Q Growth",
  total_assets: "Total Assets",
  total_debt: "Total Debt",
};

function ratingColor(rating: string) {
  const r = rating.toLowerCase();
  if (r === "excellent") return "text-emerald-400";
  if (r === "good") return "text-emerald-300";
  if (r === "neutral") return "text-blue-300";
  if (r === "bad") return "text-red-400";
  if (r === "horrible") return "text-red-500";
  if (r === "complex") return "text-amber-300";
  return "text-muted";
}

function ratingBg(rating: string) {
  const r = rating.toLowerCase();
  if (r === "excellent") return "bg-emerald-400/15 border-emerald-400/25";
  if (r === "good") return "bg-emerald-300/15 border-emerald-300/25";
  if (r === "neutral") return "bg-blue-300/15 border-blue-300/25";
  if (r === "bad") return "bg-red-400/15 border-red-400/25";
  if (r === "horrible") return "bg-red-500/15 border-red-500/25";
  if (r === "complex") return "bg-amber-300/15 border-amber-300/25";
  return "bg-white/[0.08] border-white/[0.08]";
}

function ratingGlow(rating: string) {
  const r = rating.toLowerCase();
  if (r === "excellent") return "rgba(52, 211, 153, 0.35)";
  if (r === "good") return "rgba(110, 231, 183, 0.35)";
  if (r === "neutral") return "rgba(147, 197, 253, 0.35)";
  if (r === "bad") return "rgba(248, 113, 113, 0.35)";
  if (r === "horrible") return "rgba(239, 68, 68, 0.35)";
  if (r === "complex") return "rgba(252, 211, 77, 0.35)";
  return "rgba(161, 161, 170, 0.25)";
}


interface Props {
  modelsUsed: string[];
  metricsToDebate: string[];
  onDebate: (models: string[], metrics: string[], rounds: number) => void;
  debating: boolean;
  debateData: DebateResponse | null;
  debateError: string | null;
  currentDebateMetric: string | null;
  reveal: boolean;
  initialRatings: Record<string, Record<string, string>>;
  isLoggedIn?: boolean;
  onFeatureGate?: (msg: string) => void;
}

export default function DebateSection({
  modelsUsed,
  metricsToDebate,
  onDebate,
  debating,
  debateData,
  debateError,
  currentDebateMetric,
  reveal,
  initialRatings,
  isLoggedIn = true,
  onFeatureGate,
}: Props) {
  const [selectedModels, setSelectedModels] = useState<string[]>(modelsUsed);
  const [rounds, setRounds] = useState(2);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedLlm, setExpandedLlm] = useState<string | null>(null);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const canStart = selectedModels.length >= 2 && !debating;

  // Build progress phase messages from current props
  const phases = useMemo(() => {
    const msgs: string[] = [];
    for (let r = 1; r <= rounds; r++) {
      msgs.push(`Round ${r}: Models ${r === 1 ? "stating their positions" : "reviewing arguments"}...`);
      for (const m of selectedModels) {
        msgs.push(`Round ${r}: ${m} ${r === 1 ? "analyzing" : "responding"}...`);
      }
    }
    msgs.push("Final: Models committing to stances...");
    msgs.push("Final: Building consensus...");
    return msgs;
  }, [rounds, selectedModels]);

  // Advance phase index while debating
  useEffect(() => {
    if (!debating) { setPhaseIndex(0); return; }
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % phases.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [debating, phases.length]);

  // Reset expanded state when debate data changes
  useEffect(() => {
    setExpanded(null);
    setExpandedLlm(null);
  }, [debateData]);

  // Get final-round transcript entries for a metric
  const getFinalEntriesForMetric = (metric: string): DebateTranscriptEntry[] => {
    if (!debateData?.transcript) return [];
    return debateData.transcript.filter(
      (e) => e.metric === metric && String(e.round) === "final"
    );
  };

  return (
    <div className="glass-card rounded-xl p-4 md:p-6 flex flex-col gap-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${debateData && !debating ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="font-mono text-sm text-primary">Debate</span>
      </div>

      {/* Disagreement summary */}
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-sm text-primary">
          {metricsToDebate.length} metric{metricsToDebate.length > 1 ? "s" : ""} where models disagreed
        </span>
        <div className="flex flex-col items-start gap-0.5">
          {metricsToDebate.map((m) => (
            <span key={m} className="text-xs font-mono text-sky-300">- {METRIC_LABELS[m] ?? m}</span>
          ))}
        </div>
      </div>

      {/* Controls — always visible so user can adjust and re-run */}
      <div className="flex flex-col gap-2">
        {/* Model checkboxes + Rounds grouped together */}
        <div className="flex flex-wrap gap-5 justify-center">
          {modelsUsed.map((model) => (
            <label
              key={model}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
                selectedModels.includes(model)
                  ? "border-sky-300/30 bg-sky-300/10 text-sky-300"
                  : "border-white/[0.06] bg-white/[0.02] text-muted"
              } ${debating ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedModels.includes(model)}
                onChange={() => toggleModel(model)}
                disabled={debating}
                className="sr-only"
              />
              <div
                className={`w-3.5 h-3.5 md:w-3 md:h-3 rounded-sm border flex items-center justify-center ${
                  selectedModels.includes(model)
                    ? "border-sky-300 bg-sky-300/20"
                    : "border-white/20"
                }`}
              >
                {selectedModels.includes(model) && (
                  <svg
                    className="w-2 h-2 text-sky-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {model}
            </label>
          ))}
        </div>

        {/* Rounds selector — grouped tight with model chips */}
        <div className="flex justify-center">
          <label className="flex items-center gap-2 text-xs text-muted font-mono">
            Rounds:
            <select
              value={rounds}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 2 && !isLoggedIn) {
                  onFeatureGate?.("To increase debate rounds for deeper accuracy, please sign up for free.");
                  return;
                }
                setRounds(val);
              }}
              disabled={debating}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-primary font-mono outline-none focus:border-amber-300/30 disabled:opacity-40"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </label>
        </div>
      </div>

      {/* More space before the action button */}
      <div className="h-0" />

      {/* Start / Re-Debate button */}
      {debateData ? (
        /* After consensus: demoted secondary button */
        <button
          disabled={!canStart}
          onClick={() => {
            if (!isLoggedIn) {
              onFeatureGate?.("To re-debate for refined accuracy, please sign up for free.");
              return;
            }
            onDebate(selectedModels, metricsToDebate, rounds);
          }}
          className={`mx-auto px-4 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-all ${
            debating
              ? "text-muted opacity-40 cursor-not-allowed"
              : canStart
                ? "text-muted border border-white/[0.08] hover:border-white/[0.15] hover:text-primary cursor-pointer"
                : "text-muted opacity-40 cursor-not-allowed"
          }`}
        >
          {debating ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Debating...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Not satisfied? Re-debate
            </>
          )}
        </button>
      ) : (
        /* Before results: prominent primary button */
        <button
          disabled={!canStart}
          onClick={() => onDebate(selectedModels, metricsToDebate, rounds)}
          className={`mx-auto px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
            debating
              ? "bg-amber-400/10 border border-amber-400/20 text-amber-300 opacity-60 cursor-not-allowed"
              : canStart
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 hover:border-amber-400/40 cursor-pointer"
                : "bg-amber-400/10 border border-amber-400/20 text-amber-300 opacity-40 cursor-not-allowed"
          }`}
        >
          {debating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Debating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Start Debate
            </>
          )}
        </button>
      )}

      {selectedModels.length < 2 && !debating && (
        <p className="text-[10px] text-red-400/70 font-mono text-center">
          Select at least 2 models to start a debate
        </p>
      )}

      {/* Live Transcript — progress simulation */}
      {debating && (() => {
        const hasDeep = selectedModels.some((m) => m.endsWith("_deep"));
        const waitMsg =
          rounds >= 3 && hasDeep
            ? "Deep models with multiple rounds — this will take several minutes. Feel free to keep this tab open."
            : rounds >= 2 && hasDeep
              ? "Deep models take a bit longer — expect a couple of minutes."
              : null;

        return (
          <div className="rounded-lg bg-white/[0.05] border border-amber-300/10 p-3 flex flex-col items-center gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-amber-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs font-mono text-amber-300">
                {currentDebateMetric
                  ? `Debating ${METRIC_LABELS[currentDebateMetric] ?? currentDebateMetric}...`
                  : "Live Transcript"}
              </span>
            </div>
            <p key={phaseIndex} className="text-xs text-muted font-mono animate-fadeIn text-center">
              {phases[phaseIndex]}
            </p>
            {waitMsg && (
              <p className="text-[10px] text-amber-300/50 font-mono text-center mt-1">
                {waitMsg}
              </p>
            )}
          </div>
        );
      })()}

      {/* Inline error with retry */}
      {debateError && !debating && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-400/10 border border-red-400/20 animate-fadeIn">
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300 font-medium">Debate failed</p>
            <p className="text-[10px] text-red-400/70 font-mono mt-1 break-words">{debateError}</p>
          </div>
          <button
            onClick={() => onDebate(selectedModels, metricsToDebate, rounds)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-400/15 border border-red-400/30 text-red-300 hover:bg-red-400/25 cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {debateData && (
        <>
          {/* Completed badge — only when all metrics finished */}
          {!debating && (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Consensus reached ({debateData.rounds} round{debateData.rounds > 1 ? "s" : ""}, {debateData.models_used.length} models)
            </div>
          )}

          {/* Consensus grid — clickable tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(debateData.debate_results).map(([metric, rating], idx) => {
              const isExpanded = expanded === metric;
              const hasTranscript = debateData.transcript?.some(
                (e) => e.metric === metric && String(e.round) === "final"
              );

              return (
                <button
                  key={metric}
                  onClick={() => {
                    if (!hasTranscript) return;
                    setExpanded(isExpanded ? null : metric);
                    setExpandedLlm(null);
                  }}
                  className={`${reveal ? "animate-metricReveal" : "opacity-0"} flex flex-col gap-2 p-3 rounded-lg border text-left transition-colors ${
                    isExpanded
                      ? "border-sky-300/20 bg-sky-300/5"
                      : `${ratingBg(rating)} ${hasTranscript ? "hover:bg-white/[0.10] cursor-pointer" : ""}`
                  }`}
                  style={reveal ? { animationDelay: `${idx * 200}ms`, "--glow-color": ratingGlow(rating) } as React.CSSProperties : undefined}
                >
                  <span className="text-[11px] md:text-[10px] uppercase tracking-wider text-white">
                    {METRIC_LABELS[metric] ?? metric}
                  </span>
                  <span className={`text-sm font-medium ${ratingColor(rating)}`}>
                    {rating}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expanded: final round — per-LLM collapsible boxes with two-tier reasoning */}
          {expanded && (() => {
            const finalEntries = getFinalEntriesForMetric(expanded);
            if (finalEntries.length === 0) return null;

            const metricChanges = debateData.position_changes.filter((c) => c.metric === expanded);

            return (
              <div className="px-3 py-3 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm animate-fadeIn">
                <span className="text-primary font-medium">
                  {METRIC_LABELS[expanded] ?? expanded}
                </span>
                <span className="text-muted text-xs ml-2">Final Stances</span>

                <div className="mt-3 flex flex-col gap-2">
                  {finalEntries.map((entry) => {
                    const isLlmOpen = expandedLlm === entry.llm;
                    const change = metricChanges.find((c) => c.llm === entry.llm);

                    return (
                      <div key={entry.llm} className="rounded-lg border border-white/[0.08] overflow-hidden">
                        {/* LLM header — clickable */}
                        <button
                          onClick={() => setExpandedLlm(isLlmOpen ? null : entry.llm)}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] transition-colors text-left"
                        >
                          <span className="text-xs font-mono text-sky-300">{entry.llm}</span>
                          <div className="flex items-center gap-2">
                            {change ? (
                              <span className="flex items-center gap-1.5 text-[10px] font-mono bg-white/[0.05] px-2 py-0.5 rounded">
                                <span className={ratingColor(change.from)}>{change.from}</span>
                                <span className="text-sky-300">&rarr;</span>
                                <span className={ratingColor(change.to)}>{change.to}</span>
                              </span>
                            ) : (() => {
                              const heldRating = initialRatings[expanded]?.[entry.llm] ?? debateData.debate_results[expanded] ?? "—";
                              return (
                                <span className="flex items-center gap-1.5 text-[10px] font-mono bg-white/[0.03] px-2 py-0.5 rounded text-muted">
                                  Held <span className={ratingColor(heldRating)}>{heldRating}</span>
                                </span>
                              );
                            })()}
                            <svg
                              className={`w-3 h-3 text-muted transition-transform ${isLlmOpen ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* LLM reasoning — shown directly on expand */}
                        {isLlmOpen && (
                          <div className="px-3 py-2.5 border-t border-white/[0.06] animate-fadeIn max-h-48 overflow-y-auto">
                            <p className="text-xs text-white whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Position changes — per-LLM columns (only after all metrics done) */}
          {!debating && (
            <div className="animate-fadeIn">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-3 font-mono">Position Changes</p>
              <div className={`grid gap-3 ${selectedModels.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
                {selectedModels.map((model) => {
                  const modelChanges = debateData.position_changes.filter((c) => c.llm === model);
                  return (
                    <div key={model} className="border-l-2 border-sky-300/20 pl-3 py-1.5">
                      <p className="text-xs font-mono text-sky-300 mb-1.5">{model}</p>
                      {modelChanges.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {modelChanges.map((change, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono">
                              <span className="text-muted/60">{METRIC_LABELS[change.metric] ?? change.metric}</span>
                              <span className={ratingColor(change.from)}>{change.from}</span>
                              <span className="text-sky-300">&rarr;</span>
                              <span className={ratingColor(change.to)}>{change.to}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted/50 font-mono">Maintained all its ratings</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
