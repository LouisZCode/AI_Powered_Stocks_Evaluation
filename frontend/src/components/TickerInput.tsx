"use client";

import { useState, useEffect } from "react";
import { getModels } from "@/lib/api";

/** "claude_fast" → "Claude" */
function formatModelName(key: string): string {
  const name = key.split("_")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Group models by suffix: { "Fast Analysis": ["claude_fast", ...], "Deep Analysis": ["grok_deep", ...] } */
function groupModels(models: string[]): { label: string; models: string[] }[] {
  const groups: Record<string, string[]> = {};
  for (const m of models) {
    const parts = m.split("_");
    const tier = parts[parts.length - 1];
    const label = tier.charAt(0).toUpperCase() + tier.slice(1) + " Analysis";
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }
  // Sort: "Fast Analysis" first, then "Deep Analysis"
  const order = ["Fast Analysis", "Deep Analysis"];
  return Object.entries(groups)
    .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
    .map(([label, models]) => ({ label, models: models.sort((a, b) => a.localeCompare(b)) }));
}

interface Props {
  onSubmit: (ticker: string, models: string[]) => void;
  disabled: boolean;
  initialTicker?: string;
}

export default function TickerInput({ onSubmit, disabled, initialTicker = "" }: Props) {
  const [ticker, setTicker] = useState(initialTicker);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>(["", "", ""]);
  const [extraRows, setExtraRows] = useState(0);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    getModels()
      .then((data) => setAvailableModels(data.available_models))
      .catch(() => setAvailableModels([]))
      .finally(() => setLoadingModels(false));
  }, []);

  const modelGroups = groupModels(availableModels);

  const updateSlot = (index: number, value: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleExpand = () => {
    if (extraRows < 2) {
      setSlots((prev) => [...prev, "", "", ""]);
      setExtraRows((prev) => prev + 1);
    }
  };

  const selectedModels = slots.filter((s) => s !== "");
  const hasAtLeastOne = selectedModels.length >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t || !hasAtLeastOne) return;
    // Deduplicate in case user picks same model in two slots
    onSubmit(t, [...new Set(selectedModels)]);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Model dropdowns */}
      {loadingModels ? (
        <span className="text-xs text-muted">Loading models...</span>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Row 1: slots 0-2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-muted uppercase tracking-wider">
                  Model {i + 1}{i === 0 ? " *" : " (optional)"}
                </label>
                <select
                  value={slots[i]}
                  onChange={(e) => updateSlot(i, e.target.value)}
                  disabled={disabled}
                  className={`w-full bg-white/[0.03] border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-sky-300/30 transition-colors disabled:opacity-40 appearance-none cursor-pointer ${
                    slots[i]
                      ? "border-sky-300/30 text-sky-300"
                      : "border-white/[0.06] text-muted"
                  }`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                  }}
                >
                  <option value="" className="bg-[#0a0e14] text-white/50">— Select —</option>
                  {modelGroups.map((group) => (
                    <optgroup key={group.label} label={group.label} className="bg-[#0a0e14] text-white/40">
                      {group.models.map((model) => (
                        <option key={model} value={model} className="bg-[#0a0e14] text-white">{formatModelName(model)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Extra rows (up to 2 more = 9 total) */}
          {Array.from({ length: extraRows }, (_, row) => {
            const start = (row + 1) * 3;
            return (
              <div key={row} className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
                {[start, start + 1, start + 2].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-muted uppercase tracking-wider">
                      Model {i + 1} (optional)
                    </label>
                    <select
                      value={slots[i]}
                      onChange={(e) => updateSlot(i, e.target.value)}
                      disabled={disabled}
                      className={`w-full bg-white/[0.03] border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-sky-300/30 transition-colors disabled:opacity-40 appearance-none cursor-pointer ${
                        slots[i]
                          ? "border-sky-300/30 text-sky-300"
                          : "border-white/[0.06] text-muted"
                      }`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                      }}
                    >
                      <option value="" className="bg-[#0a0e14] text-white/50">— Select —</option>
                      {modelGroups.map((group) => (
                        <optgroup key={group.label} label={group.label} className="bg-[#0a0e14] text-white/40">
                          {group.models.map((model) => (
                            <option key={model} value={model} className="bg-[#0a0e14] text-white">{formatModelName(model)}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            );
          })}

          {/* + button — shows until we have all 3 rows */}
          {extraRows < 2 && (
            <button
              type="button"
              onClick={handleExpand}
              disabled={disabled}
              className="mx-auto flex items-center gap-1.5 text-xs font-mono text-muted hover:text-sky-300 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <svg className="w-4 h-4 border border-white/10 rounded-full p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              More models
            </button>
          )}
        </div>
      )}

      {/* Ticker input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-sm">
            $
          </span>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="AAPL"
            disabled={disabled}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-7 pr-4 py-3 text-primary font-mono text-sm placeholder:text-muted/50 focus:outline-none focus:border-sky-300/30 transition-colors disabled:opacity-40"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !ticker.trim() || !hasAtLeastOne}
          className="w-full sm:w-auto px-6 py-3 bg-sky-300/10 border border-sky-300/20 rounded-lg text-sky-300 text-sm font-medium hover:bg-sky-300/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {disabled ? "Processing..." : "Evaluate"}
        </button>
      </div>
    </form>
  );
}
