import type {
  ModelsResponse,
  IngestionResponse,
  AnalysisResponse,
  HarmonizationResponse,
  DebateResponse,
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
  models: string[],
  sessionId?: string
): Promise<AnalysisResponse> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const res = await fetch(`${API}/analisys/financials/${ticker}${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models }),
  });
  if (!res.ok) throw new Error(`Analysis failed for ${ticker}`);
  return res.json();
}

export async function analyzeSingleModel(
  ticker: string,
  model: string,
  sessionId?: string
): Promise<AnalysisResponse> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const res = await fetch(`${API}/analisys/financials/${ticker}${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models: [model] }),
  });
  if (!res.ok) {
    let detail = `Analysis failed for ${model}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function harmonizeResults(
  ticker: string,
  models: string[],
  sessionId?: string
): Promise<HarmonizationResponse> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const res = await fetch(`${API}/harmonization/financials/${ticker}${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models }),
  });
  if (!res.ok) {
    let detail = "Harmonization failed";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
      if (body.error) detail = body.error;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function debateMetrics(
  ticker: string,
  models: string[],
  metrics: string[],
  rounds: number,
  sessionId?: string
): Promise<DebateResponse> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const res = await fetch(`${API}/debate/financials/${ticker}${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models, metrics, rounds }),
  });
  if (!res.ok) {
    let detail = "Debate failed";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
      if (body.error) detail = body.error;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function generateReport(
  ticker: string,
  models: string[],
  debateResults: Record<string, string>,
  positionChanges: { llm: string; metric: string; from: string; to: string }[],
  debateRounds: number
): Promise<Blob> {
  const res = await fetch(`${API}/report/financials/${ticker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      models,
      debate_results: debateResults,
      position_changes: positionChanges,
      debate_rounds: debateRounds,
    }),
  });
  if (!res.ok) {
    let detail = "Report generation failed";
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
      if (body.error) detail = body.error;
    } catch {}
    throw new Error(detail);
  }
  // Backend may return JSON error even on 200
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await res.json();
    throw new Error(body.error ?? "Report generation failed");
  }
  return res.blob();
}
