import type { ModelStatus } from "@/lib/types";

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
          className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg animate-fadeIn"
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
      return <span className="text-xs text-amber-400/80">analyzing...</span>;
    case "done":
      return (
        <span className="text-xs text-emerald-400/80">
          {elapsedMs !== null ? `${(elapsedMs / 1000).toFixed(1)}s` : "done"}
        </span>
      );
    case "error":
      return (
        <span className="text-xs text-red-400/80">
          {error ?? "failed"}
        </span>
      );
  }
}
