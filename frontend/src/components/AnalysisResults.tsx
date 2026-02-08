import type { AnalysisResponse } from "@/lib/types";
import AnalysisCard from "./AnalysisCard";

interface Props {
  data: AnalysisResponse;
}

export default function AnalysisResults({ data }: Props) {
  const entries = Object.entries(data.evaluations);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-300" />
        <span className="text-xs text-muted uppercase tracking-wider">
          {entries.length} model{entries.length > 1 ? "s" : ""} responded
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entries.map(([model, analysis], idx) => (
          <AnalysisCard key={model} model={model} analysis={analysis} index={idx} />
        ))}
      </div>

      {/* Harmonize button — visible but not wired yet */}
      <button
        disabled
        className="mx-auto mt-2 px-6 py-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-amber-300 text-sm font-medium opacity-60 cursor-not-allowed flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        Harmonize Results
        <span className="text-[10px] text-muted">(coming soon)</span>
      </button>
    </div>
  );
}
