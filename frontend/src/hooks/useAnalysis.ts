"use client";

import { useState, useCallback } from "react";
import { ingestFinancials, analyzeFinancials } from "@/lib/api";
import type {
  Phase,
  IngestionResponse,
  AnalysisResponse,
} from "@/lib/types";

export function useAnalysis() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ingestionData, setIngestionData] =
    useState<IngestionResponse | null>(null);
  const [analysisData, setAnalysisData] =
    useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (ticker: string, models: string[]) => {
    setError(null);
    setIngestionData(null);
    setAnalysisData(null);

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

      // Phase 2: Analysis
      setPhase("analyzing");
      const analysis = await analyzeFinancials(ticker, models);
      setAnalysisData(analysis);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  return { phase, ingestionData, analysisData, error, run };
}
