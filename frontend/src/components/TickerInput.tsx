"use client";

import { useState, useEffect } from "react";
import { getModels } from "@/lib/api";

interface Props {
  onSubmit: (ticker: string, models: string[]) => void;
  disabled: boolean;
}

export default function TickerInput({ onSubmit, disabled }: Props) {
  const [ticker, setTicker] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    getModels()
      .then((data) => {
        setAvailableModels(data.available_models);
        setSelectedModels([]);
      })
      .catch(() => setAvailableModels([]))
      .finally(() => setLoadingModels(false));
  }, []);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t || selectedModels.length === 0) return;
    onSubmit(t, selectedModels);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Model checkboxes */}
      <div className="flex flex-wrap gap-2">
        {loadingModels ? (
          <span className="text-xs text-muted">Loading models...</span>
        ) : (
          availableModels.map((model) => (
            <label
              key={model}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-md border text-xs font-mono cursor-pointer transition-colors ${
                selectedModels.includes(model)
                  ? "border-sky-300/30 bg-sky-300/10 text-sky-300"
                  : "border-white/[0.06] bg-white/[0.02] text-muted"
              } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedModels.includes(model)}
                onChange={() => toggleModel(model)}
                disabled={disabled}
                className="sr-only"
              />
              <div
                className={`w-3.5 h-3.5 md:w-3 md:h-3 rounded-sm border flex items-center justify-center ${
                  selectedModels.includes(model)
                    ? "border-sky-300 bg-sky-300/20"
                    : "border-white/20"
                }`}
              >
                {selectedModels.includes(model) && (
                  <svg
                    className="w-2 h-2 text-sky-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              {model}
            </label>
          ))
        )}
      </div>

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
          disabled={disabled || !ticker.trim() || selectedModels.length === 0}
          className="w-full sm:w-auto px-6 py-3 bg-sky-300/10 border border-sky-300/20 rounded-lg text-sky-300 text-sm font-medium hover:bg-sky-300/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {disabled ? "Processing..." : "Evaluate"}
        </button>
      </div>
    </form>
  );
}
