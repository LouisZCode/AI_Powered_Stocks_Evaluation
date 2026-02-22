"use client";

import { useState, useCallback, useRef } from "react";
import { ingestFinancials, analyzeSingleModel, harmonizeResults, debateMetrics } from "@/lib/api";
import type {
  Phase,
  IngestionResponse,
  AnalysisResponse,
  HarmonizationResponse,
  DebateResponse,
  ModelStatus,
  FinancialAnalysis,
} from "@/lib/types";

function accumulateDebateResult(prev: DebateResponse | null, result: DebateResponse): DebateResponse {
  if (!prev) return result;
  return {
    ticker: result.ticker,
    models_used: result.models_used,
    rounds: result.rounds,
    debate_results: { ...prev.debate_results, ...result.debate_results },
    position_changes: [...prev.position_changes, ...result.position_changes],
    transcript: [...prev.transcript, ...result.transcript],
  };
}

export function useAnalysis() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ingestionData, setIngestionData] =
    useState<IngestionResponse | null>(null);
  const [analysisData, setAnalysisData] =
    useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);
  const [harmonizationData, setHarmonizationData] = useState<HarmonizationResponse | null>(null);
  const [harmonizing, setHarmonizing] = useState(false);
  const [debateData, setDebateData] = useState<DebateResponse | null>(null);
  const [debating, setDebating] = useState(false);
  const [debateError, setDebateError] = useState<string | null>(null);
  const [currentDebateMetric, setCurrentDebateMetric] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const evaluationsRef = useRef<Record<string, FinancialAnalysis>>({});
  const progressBarRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");

  const run = useCallback(async (ticker: string, models: string[]) => {
    const sessionId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    sessionIdRef.current = sessionId;

    setError(null);
    setRateLimited(false);
    setIngestionData(null);
    setAnalysisData(null);
    setHarmonizationData(null);
    setDebateData(null);
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
      const ingestionStart = Date.now();
      const ingestion = await ingestFinancials(ticker);
      setIngestionData(ingestion);

      if (ingestion.status === "not_found") {
        setError(ingestion.message ?? `No SEC filings found for ${ticker}`);
        setPhase("error");
        return;
      }

      // Minimum ingestion display time (6-12s) so cached data still animates
      const ingestionElapsed = Date.now() - ingestionStart;
      const minIngestion = (6 + Math.random() * 6) * 1000;
      if (ingestionElapsed < minIngestion) {
        await new Promise((r) => setTimeout(r, minIngestion - ingestionElapsed));
      }

      // Signal RAF loop to stop, then fill bar to 100%
      if (progressBarRef.current) {
        progressBarRef.current.dataset.done = "true";
        progressBarRef.current.style.width = "100%";
      }
      await new Promise((r) => setTimeout(r, 700));

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

          // Only fake-delay cached results (returned in < 3s)
          const elapsed = Date.now() - startedAt;
          if (elapsed < 3000) {
            const minDelay = (8 + Math.random() * 5) * 1000;
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
          // Parse specific error types for better messages
          let errorMsg = "Failed";
          if (err instanceof TypeError && err.message === "Failed to fetch") {
            errorMsg = "Network error — backend unreachable";
          } else if (err instanceof DOMException && err.name === "AbortError") {
            errorMsg = "Request timed out";
          } else if (err instanceof Error) {
            errorMsg = err.message;
          }

          // Mark error
          setModelStatuses((prev) =>
            prev.map((ms) =>
              ms.model === model
                ? {
                    ...ms,
                    status: "error",
                    elapsedMs: Date.now() - startedAt,
                    error: errorMsg,
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
        // Check if all failures were rate-limit (429)
        setModelStatuses((prev) => {
          const isRateLimited = prev.every(
            (ms) => ms.status === "error" && ms.error === "__RATE_LIMITED__"
          );
          if (isRateLimited) {
            setRateLimited(true);
          } else {
            setError("All model analyses failed");
          }
          return prev;
        });
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  const harmonize = useCallback(async (ticker: string, models: string[]) => {
    setHarmonizing(true);
    setDebateData(null);
    setDebateError(null);
    try {
      const result = await harmonizeResults(ticker, models, sessionIdRef.current);
      setHarmonizationData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harmonization failed");
    } finally {
      setHarmonizing(false);
    }
  }, []);

  const debate = useCallback(async (ticker: string, models: string[], metrics: string[], rounds: number) => {
    setDebating(true);
    setDebateData(null);
    setDebateError(null);
    setCurrentDebateMetric(null);

    for (const metric of metrics) {
      setCurrentDebateMetric(metric);
      try {
        const result = await debateMetrics(ticker, models, [metric], rounds, sessionIdRef.current);
        setDebateData((prev) => accumulateDebateResult(prev, result));
      } catch (err) {
        setDebateError(err instanceof Error ? err.message : "Debate failed");
        break;
      }
    }

    setCurrentDebateMetric(null);
    setDebating(false);
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setIngestionData(null);
    setAnalysisData(null);
    setHarmonizationData(null);
    setDebateData(null);
    setDebateError(null);
    setError(null);
    setRateLimited(false);
    setModelStatuses([]);
    evaluationsRef.current = {};
    sessionIdRef.current = "";
  }, []);

  return { phase, ingestionData, analysisData, harmonizationData, harmonizing, debateData, debating, debateError, currentDebateMetric, error, rateLimited, modelStatuses, run, harmonize, debate, reset, progressBarRef };
}
