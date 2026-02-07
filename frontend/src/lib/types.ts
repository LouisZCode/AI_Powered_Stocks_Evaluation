// Backend response types — field names match backend exactly

export interface ModelsResponse {
  available_models: string[];
}

export interface IngestionResponse {
  status: "exists" | "ingested" | "not_found";
  ticker: string;
  chunks: number;
  latest_filing_date: string | null;
  message?: string;
}

export interface FinancialAnalysis {
  stock: string;
  revenue: string;
  revenue_reason: string;
  net_income: string;
  net_income_reason: string;
  gross_margin: string;
  gross_margin_reason: string;
  operational_costs: string;
  operational_costs_reason: string;
  cash_flow: string;
  cash_flow_reason: string;
  quarterly_growth: string;
  quarterly_growth_reason: string;
  total_assets: string;
  total_assets_reason: string;
  total_debt: string;
  total_debt_reason: string;
  financial_strenght: string; // typo matches backend
  overall_summary: string;
}

export interface AnalysisResponse {
  evaluations: Record<string, FinancialAnalysis>;
}

export type Phase = "idle" | "ingesting" | "analyzing" | "done" | "error";

export const METRICS = [
  "revenue",
  "net_income",
  "gross_margin",
  "operational_costs",
  "cash_flow",
  "quarterly_growth",
  "total_assets",
  "total_debt",
] as const;

export type MetricKey = (typeof METRICS)[number];

export type ModelRunStatus = "pending" | "running" | "done" | "error";
export interface ModelStatus {
  model: string;
  status: ModelRunStatus;
  startedAt: number | null;
  elapsedMs: number | null;
  error: string | null;
}
