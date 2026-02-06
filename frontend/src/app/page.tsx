"use client";

import { useAnalysis } from "@/hooks/useAnalysis";
import ParticleCanvas from "@/components/ParticleCanvas";
import GlassContainer from "@/components/GlassContainer";
import Header from "@/components/Header";
import TickerInput from "@/components/TickerInput";
import PhaseStatus from "@/components/PhaseStatus";
import AnalysisResults from "@/components/AnalysisResults";

export default function Home() {
  const { phase, ingestionData, analysisData, error, run } = useAnalysis();
  const isLoading = phase === "ingesting" || phase === "analyzing";

  return (
    <>
      <ParticleCanvas isThinking={isLoading} />
      <GlassContainer>
        <Header phase={phase} />
        <TickerInput onSubmit={run} disabled={isLoading} />
        <PhaseStatus phase={phase} ingestionData={ingestionData} error={error} />
        {phase === "done" && analysisData && (
          <AnalysisResults data={analysisData} />
        )}
      </GlassContainer>
    </>
  );
}
