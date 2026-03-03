/** Shared token cost formulas — must match backend routes/auth.py */

function isDeep(model: string): boolean {
  return model.endsWith("_deep");
}

/** Cost for analysis: 2 tokens per fast model, 10 per deep model */
export function analysisCost(models: string[]): number {
  return models.reduce((sum, m) => sum + (isDeep(m) ? 10 : 2), 0);
}

/** Cost for debate: (1 if fast, 2 if deep) × metrics × rounds — summed per model */
export function debateCost(
  models: string[],
  metricsCount: number,
  rounds: number,
): number {
  return models.reduce(
    (sum, m) => sum + (isDeep(m) ? 2 : 1) * metricsCount * rounds,
    0,
  );
}
