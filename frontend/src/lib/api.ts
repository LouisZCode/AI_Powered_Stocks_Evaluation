import type {
  ModelsResponse,
  IngestionResponse,
  AnalysisResponse,
  HarmonizationResponse,
  DebateResponse,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getModels(): Promise<ModelsResponse> {
  const res = await fetch(`${API}/models/`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch models");
  return res.json();
}

export async function ingestFinancials(
  ticker: string,
  signal?: AbortSignal
): Promise<IngestionResponse> {
  const res = await fetch(`${API}/ingestion/financials/${ticker}`, {
    method: "POST",
    credentials: "include",
    signal,
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
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Analysis failed for ${ticker}`);
  return res.json();
}

export async function analyzeSingleModel(
  ticker: string,
  model: string,
  sessionId?: string,
  signal?: AbortSignal
): Promise<AnalysisResponse> {
  const params = sessionId ? `?session_id=${sessionId}` : "";
  const res = await fetch(`${API}/analisys/financials/${ticker}${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models: [model] }),
    credentials: "include",
    signal,
  });
  if (!res.ok) {
    if (res.status === 402) {
      throw new Error("__INSUFFICIENT_TOKENS__");
    }
    if (res.status === 429) {
      throw new Error("__RATE_LIMITED__");
    }
    let detail = `Analysis failed for ${model}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function deductTokens(models: string[]): Promise<{ token_balance: number }> {
  const res = await fetch(`${API}/auth/deduct-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ models }),
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 402) throw new Error("__INSUFFICIENT_TOKENS__");
    throw new Error("Token deduction failed");
  }
  return res.json();
}

export async function deductDebateTokens(
  metricsCount: number,
  rounds: number
): Promise<{ token_balance: number; cost: number }> {
  const res = await fetch(`${API}/auth/deduct-debate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics_count: metricsCount, rounds }),
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 402) throw new Error("__INSUFFICIENT_TOKENS__");
    throw new Error("Debate token deduction failed");
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
    credentials: "include",
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
    credentials: "include",
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
  debateRounds: number,
  domain?: string | null
): Promise<Blob> {
  const res = await fetch(`${API}/report/financials/${ticker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      models,
      debate_results: debateResults,
      position_changes: positionChanges,
      debate_rounds: debateRounds,
      domain: domain ?? undefined,
    }),
    credentials: "include",
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
