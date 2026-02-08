"use client";

import { useRef } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import ParticleCanvas from "@/components/ParticleCanvas";
import GlassContainer from "@/components/GlassContainer";
import Header from "@/components/Header";
import TickerInput from "@/components/TickerInput";
import PhaseStatus from "@/components/PhaseStatus";
import AnalysisResults from "@/components/AnalysisResults";

export default function AnalyzePage() {
  const { phase, ingestionData, analysisData, error, modelStatuses, run } = useAnalysis();
  const isLoading = phase === "ingesting" || phase === "analyzing";
  const progressBarRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <ParticleCanvas phase={phase} progressBarRef={progressBarRef} />
      <GlassContainer>
        <Header phase={phase} />
        <TickerInput onSubmit={run} disabled={isLoading} />
        <PhaseStatus phase={phase} ingestionData={ingestionData} error={error} modelStatuses={modelStatuses} progressBarRef={progressBarRef} />
        {phase === "done" && analysisData && (
          <AnalysisResults data={analysisData} />
        )}
      </GlassContainer>
    </>
  );
}
