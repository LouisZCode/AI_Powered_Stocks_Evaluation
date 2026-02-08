"use client";

import { useState } from "react";
import type { FinancialAnalysis, MetricKey } from "@/lib/types";
import { METRICS } from "@/lib/types";

interface Props {
  model: string;
  analysis: FinancialAnalysis;
}

const METRIC_LABELS: Record<MetricKey, string> = {
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
  if (r === "excellent") return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (r === "good") return "text-emerald-300 bg-emerald-300/10 border-emerald-300/20";
  if (r === "neutral") return "text-amber-400 bg-amber-400/10 border-amber-400/20";
  if (r === "bad") return "text-red-400 bg-red-400/10 border-red-400/20";
  if (r === "horrible") return "text-red-500 bg-red-500/10 border-red-500/20";
  return "text-muted bg-white/5 border-white/10";
}

function strengthColor(strength: string) {
  const match = strength.match(/(\d+)/);
  if (!match) return "text-muted";
  const n = parseInt(match[1]);
  if (n >= 6) return "text-emerald-400";
  if (n >= 4) return "text-amber-400";
  return "text-red-400";
}

export default function AnalysisCard({ model, analysis }: Props) {
  const [expanded, setExpanded] = useState<MetricKey | null>(null);

  return (
    <div className="glass rounded-xl p-3.5 md:p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-300" />
          <span className="font-mono text-sm text-primary">{model}</span>
        </div>
        <span
          className={`font-mono text-xs font-semibold ${strengthColor(analysis.financial_strenght)}`}
        >
          {analysis.financial_strenght}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {METRICS.map((key) => {
          const value = analysis[key];
          const reason = analysis[`${key}_reason` as keyof FinancialAnalysis];
          const isExpanded = expanded === key;

          return (
            <button
              key={key}
              onClick={() => setExpanded(isExpanded ? null : key)}
              className={`flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-colors ${
                isExpanded
                  ? "border-sky-300/20 bg-sky-300/5"
                  : "border-white/[0.08] bg-white/[0.08] hover:bg-white/[0.10]"
              }`}
            >
              <span className="text-[11px] md:text-[10px] uppercase tracking-wider text-muted">
                {METRIC_LABELS[key]}
              </span>
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded border w-fit ${ratingColor(value)}`}
              >
                {value}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded reason */}
      {expanded && (
        <div className="px-3 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-xs text-muted leading-relaxed animate-fadeIn">
          <span className="text-primary font-medium">
            {METRIC_LABELS[expanded]}:
          </span>{" "}
          {analysis[`${expanded}_reason` as keyof FinancialAnalysis]}
        </div>
      )}

      {/* Summary */}
      <p className="text-xs text-muted leading-relaxed border-t border-white/[0.08] pt-3">
        {analysis.overall_summary}
      </p>
    </div>
  );
}
