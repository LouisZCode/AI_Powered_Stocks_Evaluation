"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Phase, IngestionResponse, ModelStatus } from "@/lib/types";
import LlmTracker from "@/components/LlmTracker";

interface Props {
  phase: Phase;
  ingestionData: IngestionResponse | null;
  error: string | null;
  modelStatuses: ModelStatus[];
  progressBarRef: RefObject<HTMLDivElement | null>;
}

export default function PhaseStatus({ phase, ingestionData, error, modelStatuses, progressBarRef }: Props) {
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (phase !== "ingesting") return;

    const startTime = performance.now();
    let rafId: number;

    const tick = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      // Two-phase curve: fast ramp to ~80%, then crawls toward 97%
      // fast: 82 * (1-e^(-t/5))  → ~28% at 2s, ~52% at 5s, ~71% at 10s
      // slow: 15 * (1-e^(-t/25)) → adds ~1% at 2s, ~5% at 10s, crawls after
      const fast = 82 * (1 - Math.exp(-elapsed / 5));
      const slow = 15 * (1 - Math.exp(-elapsed / 25));
      const pct = Math.min(fast + slow, 97);

      // Direct DOM updates — no React re-render needed
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${pct}%`;
      }
      if (pctRef.current) {
        pctRef.current.textContent = `${Math.round(pct)}%`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, progressBarRef]);

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

      {/* Ingesting — progress bar */}
      {phase === "ingesting" && (
        <div className="px-4 py-3 bg-sky-400/5 border border-sky-400/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-sky-300">Gathering SEC data...</span>
            <span ref={pctRef} className="text-xs text-sky-400/70 tabular-nums">0%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full rounded-full bg-sky-400/80 progress-bar-glow"
              style={{ width: "0%" }}
            />
          </div>
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
