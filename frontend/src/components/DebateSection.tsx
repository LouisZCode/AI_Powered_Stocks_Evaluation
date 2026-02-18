"use client";

import { useState } from "react";
import type { DebateResponse } from "@/lib/types";

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
  reveal: boolean;
}

export default function DebateSection({
  modelsUsed,
  metricsToDebate,
  onDebate,
  debating,
  debateData,
  debateError,
  reveal,
}: Props) {
  const [selectedModels, setSelectedModels] = useState<string[]>(modelsUsed);
  const [rounds, setRounds] = useState(2);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const canStart = selectedModels.length >= 2 && !debating && !debateData;

  return (
    <div className="glass-card rounded-xl p-3.5 md:p-5 flex flex-col gap-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-mono text-sm text-primary">Debate</span>
        </div>
        <span className="text-xs font-mono text-red-400">
          {metricsToDebate.length} metric{metricsToDebate.length > 1 ? "s" : ""} need resolution
        </span>
      </div>

      {/* Controls — hidden after results */}
      {!debateData && (
        <div className="flex flex-col gap-3">
          {/* Model checkboxes */}
          <div className="flex flex-wrap gap-2">
            {modelsUsed.map((model) => (
              <label
                key={model}
                className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-md border text-xs font-mono cursor-pointer transition-colors ${
                  selectedModels.includes(model)
                    ? "border-amber-300/30 bg-amber-300/10 text-amber-300"
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
                      ? "border-amber-300 bg-amber-300/20"
                      : "border-white/20"
                  }`}
                >
                  {selectedModels.includes(model) && (
                    <svg
                      className="w-2 h-2 text-amber-300"
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

          {/* Rounds + Start */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted font-mono">
              Rounds:
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                disabled={debating}
                className="bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1 text-xs text-primary font-mono outline-none focus:border-amber-300/30 disabled:opacity-40"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>

            <button
              disabled={!canStart}
              onClick={() => onDebate(selectedModels, metricsToDebate, rounds)}
              className={`ml-auto px-5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                debating
                  ? "bg-red-400/10 border border-red-400/20 text-red-300 opacity-60 cursor-not-allowed"
                  : canStart
                    ? "bg-red-400/15 border border-red-400/30 text-red-300 hover:bg-red-400/25 hover:border-red-400/40 cursor-pointer"
                    : "bg-red-400/10 border border-red-400/20 text-red-300 opacity-40 cursor-not-allowed"
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Start Debate
                </>
              )}
            </button>
          </div>

          {selectedModels.length < 2 && !debating && (
            <p className="text-[10px] text-red-400/70 font-mono">
              Select at least 2 models to start a debate
            </p>
          )}

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
                className="shrink-0 px-3 py-1.5 rounded-md text-[10px] font-medium bg-red-400/15 border border-red-400/30 text-red-300 hover:bg-red-400/25 cursor-pointer transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {debateData && (
        <>
          {/* Completed badge */}
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Debated ({debateData.rounds} round{debateData.rounds > 1 ? "s" : ""}, {debateData.models_used.length} models)
          </div>

          {/* Consensus grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(debateData.debate_results).map(([metric, rating], idx) => (
              <div
                key={metric}
                className={`${reveal ? "animate-metricReveal" : "opacity-0"} flex flex-col gap-1.5 p-2.5 rounded-lg border ${ratingBg(rating)}`}
                style={reveal ? { animationDelay: `${idx * 200}ms`, "--glow-color": ratingGlow(rating) } as React.CSSProperties : undefined}
              >
                <span className="text-[11px] md:text-[10px] uppercase tracking-wider text-muted">
                  {METRIC_LABELS[metric] ?? metric}
                </span>
                <span className={`text-sm font-medium ${ratingColor(rating)}`}>
                  {rating}
                </span>
              </div>
            ))}
          </div>

          {/* Position changes */}
          {debateData.position_changes.length > 0 && (
            <div className="border-t border-white/[0.08] pt-3">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2 font-mono">Position Changes</p>
              <div className="flex flex-col gap-1">
                {debateData.position_changes.map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-muted">{change.llm}:</span>
                    <span className="text-muted">{METRIC_LABELS[change.metric] ?? change.metric}</span>
                    <span className={ratingColor(change.from)}>{change.from}</span>
                    <span className="text-muted/50">&rarr;</span>
                    <span className={ratingColor(change.to)}>{change.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {debateData.position_changes.length === 0 && (
            <div className="border-t border-white/[0.08] pt-3">
              <p className="text-xs text-muted font-mono">No position changes — all models held their ground.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
