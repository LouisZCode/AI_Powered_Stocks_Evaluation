"use client";

import { useState } from "react";
import type { HarmonizationResponse, HarmonizationLogEntry } from "@/lib/types";

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

function actionBadge(action: HarmonizationLogEntry["action"]) {
  switch (action) {
    case "already_aligned":
      return { label: "Aligned", cls: "text-emerald-400 bg-emerald-400/15 border-emerald-400/25", glow: "rgba(52, 211, 153, 0.35)" };
    case "harmonized":
      return { label: "Harmonized", cls: "text-amber-300 bg-amber-300/15 border-amber-300/25", glow: "rgba(252, 211, 77, 0.35)" };
    case "debate":
      return { label: "Needs Debate", cls: "text-red-400 bg-red-400/15 border-red-400/25", glow: "rgba(248, 113, 113, 0.35)" };
    case "skipped":
      return { label: "Skipped", cls: "text-zinc-400 bg-zinc-400/15 border-zinc-400/25", glow: "rgba(161, 161, 170, 0.25)" };
  }
}

function ratingColor(rating: string) {
  const r = rating.toLowerCase();
  if (r === "excellent") return "text-emerald-400";
  if (r === "good") return "text-emerald-300";
  if (r === "neutral") return "text-blue-300";
  if (r === "bad") return "text-red-400";
  if (r === "horrible") return "text-red-500";
  return "text-muted";
}

interface Props {
  data: HarmonizationResponse;
  reveal?: boolean;
}

export default function HarmonizationCard({ data, reveal = true }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { summary, harmonization_log } = data;

  return (
    <div className="glass-card rounded-xl p-3.5 md:p-5 flex flex-col gap-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-300" />
          <span className="font-mono text-sm text-primary">Harmonization</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400">{summary.already_aligned} aligned</span>
          <span className="text-muted">·</span>
          <span className="text-amber-300">{summary.harmonized} harmonized</span>
          <span className="text-muted">·</span>
          <span className="text-red-400">{summary.needs_debate} debate</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {harmonization_log.map((entry, idx) => {
          const badge = actionBadge(entry.action);
          const isExpanded = expanded === entry.metric;

          return (
            <button
              key={entry.metric}
              onClick={() => setExpanded(isExpanded ? null : entry.metric)}
              className={`${reveal ? "animate-metricReveal" : "opacity-0"} flex flex-col gap-1.5 p-2.5 rounded-lg border text-left transition-colors ${
                isExpanded
                  ? "border-sky-300/20 bg-sky-300/5"
                  : "border-white/[0.08] bg-white/[0.08] hover:bg-white/[0.10]"
              }`}
              style={reveal ? { animationDelay: `${idx * 200}ms`, "--glow-color": badge.glow } as React.CSSProperties : undefined}
            >
              <span className="text-[11px] md:text-[10px] uppercase tracking-wider text-muted">
                {METRIC_LABELS[entry.metric] ?? entry.metric}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border w-fit ${badge.cls}`}>
                {badge.label}
              </span>
              {entry.result && (
                <span className={`text-xs font-medium ${ratingColor(entry.result)}`}>
                  {entry.result}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded: per-model breakdown */}
      {expanded && (() => {
        const entry = harmonization_log.find((e) => e.metric === expanded);
        if (!entry) return null;
        const ratings = entry.ratings ?? entry.original ?? {};

        return (
          <div className="px-3 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-sm animate-fadeIn">
            <span className="text-primary font-medium">
              {METRIC_LABELS[expanded] ?? expanded}
            </span>
            {entry.reason && (
              <span className="text-muted text-xs ml-2">({entry.reason.replace(/_/g, " ")})</span>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(ratings).map(([model, rating]) => (
                <div key={model} className="flex items-center gap-1.5 bg-white/[0.05] px-2 py-1 rounded text-xs">
                  <span className="text-muted">{model}:</span>
                  <span className={rating ? ratingColor(rating) : "text-zinc-500"}>
                    {rating ?? "N/A"}
                  </span>
                </div>
              ))}
            </div>
            {entry.result && (
              <div className="mt-2 text-xs text-muted">
                Result: <span className={`font-medium ${ratingColor(entry.result)}`}>{entry.result}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Debate preview */}
      {reveal && data.metrics_to_debate.length > 0 && (
        <div className="border-t border-white/[0.08] pt-3 animate-fadeIn">
          <p className="text-xs text-muted">
            <span className="text-red-400 font-medium">{data.metrics_to_debate.length} metric{data.metrics_to_debate.length > 1 ? "s" : ""}</span>{" "}
            flagged for debate:{" "}
            <span className="text-white">
              {data.metrics_to_debate.map((m) => METRIC_LABELS[m] ?? m).join(", ")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
