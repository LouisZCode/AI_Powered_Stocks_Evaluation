import type { Phase, IngestionResponse, ModelStatus } from "@/lib/types";
import LlmTracker from "@/components/LlmTracker";

interface Props {
  phase: Phase;
  ingestionData: IngestionResponse | null;
  error: string | null;
  modelStatuses: ModelStatus[];
}

export default function PhaseStatus({ phase, ingestionData, error, modelStatuses }: Props) {
  if (phase === "idle") return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Error state */}
      {phase === "error" && error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}

      {/* Ingesting */}
      {phase === "ingesting" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-400/5 border border-amber-400/10 rounded-lg">
          <Spinner />
          <span className="text-sm text-amber-300">
            Gathering SEC data...
          </span>
        </div>
      )}

      {/* Analyzing */}
      {phase === "analyzing" && (
        <div className="flex flex-col gap-2">
          {ingestionData && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                SEC data ready — {ingestionData.chunks} chunks
                {ingestionData.latest_filing_date &&
                  ` (latest: ${ingestionData.latest_filing_date})`}
              </span>
            </div>
          )}
          <LlmTracker modelStatuses={modelStatuses} />
        </div>
      )}

      {/* Done */}
      {phase === "done" && ingestionData && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              Analysis complete — {ingestionData.chunks} chunks processed
              {ingestionData.latest_filing_date &&
                ` (filing: ${ingestionData.latest_filing_date})`}
            </span>
          </div>
          <LlmTracker modelStatuses={modelStatuses} />
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
  );
}
