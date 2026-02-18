"use client";

import { useRef, useEffect, useState } from "react";
import type { AnalysisResponse, HarmonizationResponse, DebateResponse } from "@/lib/types";
import AnalysisCard from "./AnalysisCard";
import HarmonizationCard from "./HarmonizationCard";
import DebateSection from "./DebateSection";

interface Props {
  data: AnalysisResponse;
  onHarmonize: () => void;
  harmonizing: boolean;
  harmonizationData: HarmonizationResponse | null;
  onDebate: (models: string[], metrics: string[], rounds: number) => void;
  debating: boolean;
  debateData: DebateResponse | null;
  debateError: string | null;
}

export default function AnalysisResults({ data, onHarmonize, harmonizing, harmonizationData, onDebate, debating, debateData, debateError }: Props) {
  const entries = Object.entries(data.evaluations);
  const harmCardRef = useRef<HTMLDivElement>(null);
  const debateCardRef = useRef<HTMLDivElement>(null);
  const [revealTiles, setRevealTiles] = useState(false);
  const [revealDebateTiles, setRevealDebateTiles] = useState(false);
  const [showDebate, setShowDebate] = useState(false);

  // Scroll first, then reveal tiles — harmonization
  useEffect(() => {
    if (!harmonizationData) { setRevealTiles(false); return; }
    const scrollTimer = setTimeout(() => {
      harmCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const revealTimer = setTimeout(() => {
      setRevealTiles(true);
    }, 800);
    return () => { clearTimeout(scrollTimer); clearTimeout(revealTimer); };
  }, [harmonizationData]);

  // Show debate section ~2.5s after harmonization tiles finish revealing
  useEffect(() => {
    if (!revealTiles) { setShowDebate(false); return; }
    const timer = setTimeout(() => setShowDebate(true), 2500);
    return () => clearTimeout(timer);
  }, [revealTiles]);

  // Scroll first, then reveal tiles — debate
  useEffect(() => {
    if (!debateData) { setRevealDebateTiles(false); return; }
    const scrollTimer = setTimeout(() => {
      debateCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const revealTimer = setTimeout(() => {
      setRevealDebateTiles(true);
    }, 800);
    return () => { clearTimeout(scrollTimer); clearTimeout(revealTimer); };
  }, [debateData]);

  if (entries.length === 0) return null;

  const canHarmonize = entries.length >= 2 && !harmonizationData;

  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-sky-300" />
        <span className="text-xs text-muted uppercase tracking-wider">
          {entries.length} model{entries.length > 1 ? "s" : ""} responded
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entries.map(([model, analysis], idx) => (
          <AnalysisCard key={model} model={model} analysis={analysis} index={idx} />
        ))}
      </div>

      {/* Harmonize button */}
      <button
        disabled={!canHarmonize || harmonizing}
        onClick={onHarmonize}
        className={`mx-auto mt-2 px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
          harmonizationData
            ? "bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 opacity-60 cursor-default"
            : canHarmonize && !harmonizing
              ? "bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 hover:border-amber-400/40 cursor-pointer"
              : "bg-amber-400/10 border border-amber-400/20 text-amber-300 opacity-60 cursor-not-allowed"
        }`}
      >
        {harmonizing ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Harmonizing...
          </>
        ) : harmonizationData ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Harmonized
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Harmonize Results
          </>
        )}
      </button>

      {/* Harmonization results */}
      {harmonizationData && (
        <div ref={harmCardRef}>
          <HarmonizationCard data={harmonizationData} reveal={revealTiles} />
        </div>
      )}

      {/* Debate section — shown after harmonization tiles finish revealing */}
      {harmonizationData && harmonizationData.metrics_to_debate.length > 0 && showDebate && (
        <div ref={debateCardRef}>
          <DebateSection
            modelsUsed={harmonizationData.models_used}
            metricsToDebate={harmonizationData.metrics_to_debate}
            onDebate={onDebate}
            debating={debating}
            debateData={debateData}
            debateError={debateError}
            reveal={revealDebateTiles}
          />
        </div>
      )}
    </div>
  );
}
