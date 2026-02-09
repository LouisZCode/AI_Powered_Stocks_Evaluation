"use client";

import { useState, useCallback, useRef } from "react";
import { ingestFinancials, analyzeSingleModel } from "@/lib/api";
import type {
  Phase,
  IngestionResponse,
  AnalysisResponse,
  ModelStatus,
  FinancialAnalysis,
} from "@/lib/types";

export function useAnalysis() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ingestionData, setIngestionData] =
    useState<IngestionResponse | null>(null);
  const [analysisData, setAnalysisData] =
    useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);

  const evaluationsRef = useRef<Record<string, FinancialAnalysis>>({});

  const run = useCallback(async (ticker: string, models: string[]) => {
    const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

    setError(null);
    setIngestionData(null);
    setAnalysisData(null);
    evaluationsRef.current = {};

    // Initialize all models as pending
    setModelStatuses(
      models.map((model) => ({
        model,
        status: "pending",
        startedAt: null,
        elapsedMs: null,
        error: null,
      }))
    );

    // Phase 1: Ingestion
    setPhase("ingesting");
    try {
      const ingestion = await ingestFinancials(ticker);
      setIngestionData(ingestion);

      if (ingestion.status === "not_found") {
        setError(ingestion.message ?? `No SEC filings found for ${ticker}`);
        setPhase("error");
        return;
      }

      // Phase 2: Analysis — fire N parallel single-model requests
      setPhase("analyzing");

      const promises = models.map(async (model) => {
        const startedAt = Date.now();

        // Mark running
        setModelStatuses((prev) =>
          prev.map((ms) =>
            ms.model === model ? { ...ms, status: "running", startedAt } : ms
          )
        );

        try {
          const result = await analyzeSingleModel(ticker, model, sessionId);

          // Accumulate evaluations
          Object.assign(evaluationsRef.current, result.evaluations);

          // Minimum display time: 8-13s so cached results still feel "worked on"
          const elapsed = Date.now() - startedAt;
          const minDelay = (8 + Math.random() * 5) * 1000;
          if (elapsed < minDelay) {
            await new Promise((r) => setTimeout(r, minDelay - elapsed));
          }

          // Mark done
          setModelStatuses((prev) =>
            prev.map((ms) =>
              ms.model === model
                ? { ...ms, status: "done", elapsedMs: Date.now() - startedAt }
                : ms
            )
          );
        } catch (err) {
          // Mark error
          setModelStatuses((prev) =>
            prev.map((ms) =>
              ms.model === model
                ? {
                    ...ms,
                    status: "error",
                    elapsedMs: Date.now() - startedAt,
                    error: err instanceof Error ? err.message : "Failed",
                  }
                : ms
            )
          );
        }
      });

      await Promise.allSettled(promises);

      // Merge all evaluations into analysisData
      if (Object.keys(evaluationsRef.current).length > 0) {
        setAnalysisData({ evaluations: { ...evaluationsRef.current } });
        setPhase("done");
      } else {
        setError("All model analyses failed");
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setIngestionData(null);
    setAnalysisData(null);
    setError(null);
    setModelStatuses([]);
    evaluationsRef.current = {};
  }, []);

  return { phase, ingestionData, analysisData, error, modelStatuses, run, reset };
}
