"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "ingesting") {
      if (startTimeRef.current !== null) {
        // Phase just left ingesting — snap to 100%
        setProgress(100);
        const timeout = setTimeout(() => {
          startTimeRef.current = null;
          setProgress(0);
        }, 400);
        return () => clearTimeout(timeout);
      }
      return;
    }

    // Phase is ingesting — start fake progress
    startTimeRef.current = performance.now();
    let rafId: number;

    const tick = () => {
      if (startTimeRef.current === null) return;
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      // 1 - e^(-t/6) curve, capped at 97%
      const pct = Math.min((1 - Math.exp(-elapsed / 6)) * 100, 97);
      setProgress(pct);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

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
      {(phase === "ingesting" || (progress === 100 && startTimeRef.current !== null)) && (
        <div className="px-4 py-3 bg-sky-400/5 border border-sky-400/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-sky-300">Gathering SEC data...</span>
            <span className="text-xs text-sky-400/70 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full rounded-full bg-sky-400/80 progress-bar-glow transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%` }}
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
