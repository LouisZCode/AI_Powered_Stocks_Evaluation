import type {
  ModelsResponse,
  IngestionResponse,
  AnalysisResponse,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getModels(): Promise<ModelsResponse> {
  const res = await fetch(`${API}/models/`);
  if (!res.ok) throw new Error("Failed to fetch models");
  return res.json();
}

export async function ingestFinancials(
  ticker: string
): Promise<IngestionResponse> {
  const res = await fetch(`${API}/ingestion/financials/${ticker}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Ingestion failed for ${ticker}`);
  return res.json();
}

export async function analyzeFinancials(
  ticker: string,
  models: string[]
): Promise<AnalysisResponse> {
  const res = await fetch(`${API}/analisys/financials/${ticker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models }),
  });
  if (!res.ok) throw new Error(`Analysis failed for ${ticker}`);
  return res.json();
}
