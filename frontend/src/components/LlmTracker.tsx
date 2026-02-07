import { useState, useEffect } from "react";
import type { ModelStatus } from "@/lib/types";

const ANALYSIS_PHRASES = [
  "parsing 10-K data",
  "evaluating cash flow",
  "checking balance sheet",
  "analyzing revenue trends",
  "reviewing debt ratios",
  "calculating margins",
  "assessing liquidity",
  "examining P&L statement",
  "processing financials",
  "scanning footnotes",
  "validating GAAP metrics",
  "measuring profitability",
  "tracking quarterly growth",
  "investigating assets",
  "reviewing liabilities",
  "computing EPS trends",
  "analyzing working capital",
  "checking operational costs",
  "evaluating free cash flow",
  "examining shareholder equity",
  "processing SEC filings",
  "reviewing audit notes",
  "calculating debt coverage",
  "assessing financial health",
];

interface Props {
  modelStatuses: ModelStatus[];
}

export default function LlmTracker({ modelStatuses }: Props) {
  if (modelStatuses.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {modelStatuses.map((ms) => (
        <div
          key={ms.model}
          className="flex items-center gap-3 px-4 py-6 bg-white/[0.03] border border-white/[0.06] rounded-lg animate-fadeIn overflow-hidden"
        >
          <StatusIcon status={ms.status} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-white/90 truncate capitalize">
              {ms.model}
            </span>
            <StatusLabel status={ms.status} elapsedMs={ms.elapsedMs} error={ms.error} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: ModelStatus["status"] }) {
  switch (status) {
    case "pending":
      return (
        <div className="w-4 h-4 rounded-full border-2 border-white/20 flex-shrink-0" />
      );
    case "running":
      return (
        <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
      );
    case "done":
      return (
        <svg
          className="w-4 h-4 text-emerald-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    case "error":
      return (
        <svg
          className="w-4 h-4 text-red-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
}

function StatusLabel({
  status,
  elapsedMs,
  error,
}: {
  status: ModelStatus["status"];
  elapsedMs: number | null;
  error: string | null;
}) {
  switch (status) {
    case "pending":
      return <span className="text-xs text-white/30">waiting</span>;
    case "running":
      return <RunningTextAnimation />;
    case "done":
      return (
        <span className="text-xs text-emerald-400/80">
          {elapsedMs !== null ? `${(elapsedMs / 1000).toFixed(1)}s` : "done"}
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-red-400/80 line-clamp-2">
          {error ?? "failed"}
        </span>
      );
  }
}

function RunningTextAnimation() {
  const [idx, setIdx] = useState(() =>
    Math.floor(Math.random() * ANALYSIS_PHRASES.length)
  );
  const [speed] = useState(() => 1000 + Math.random() * 1000);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % ANALYSIS_PHRASES.length);
    }, speed);
    return () => clearInterval(id);
  }, [speed]);

  return (
    <span className="text-xs text-white/50 block overflow-hidden h-4">
      <span
        key={idx}
        className="block animate-textTicker"
        style={{ animationDuration: `${speed}ms` }}
      >
        {ANALYSIS_PHRASES[idx]}
      </span>
    </span>
  );
}
