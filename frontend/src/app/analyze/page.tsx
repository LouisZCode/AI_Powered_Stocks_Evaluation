"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAnalysis } from "@/hooks/useAnalysis";
import ParticleCanvas from "@/components/ParticleCanvas";
import Nav from "@/components/Nav";
import GlassContainer from "@/components/GlassContainer";
import Header from "@/components/Header";
import TickerInput from "@/components/TickerInput";
import PhaseStatus from "@/components/PhaseStatus";
import AnalysisResults from "@/components/AnalysisResults";

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const initialTicker = searchParams.get("ticker")?.toUpperCase() || "";
  const { phase, ingestionData, analysisData, error, modelStatuses, run } = useAnalysis();
  const isLoading = phase === "ingesting" || phase === "analyzing";
  const progressBarRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <ParticleCanvas phase={phase} progressBarRef={progressBarRef} />
      <div className="relative z-10">
        <Nav />
        <GlassContainer>
          <Header phase={phase} />
          <TickerInput onSubmit={run} disabled={isLoading} initialTicker={initialTicker} />
          <PhaseStatus phase={phase} ingestionData={ingestionData} error={error} modelStatuses={modelStatuses} progressBarRef={progressBarRef} />
          {phase === "done" && analysisData && (
            <AnalysisResults data={analysisData} />
          )}
        </GlassContainer>
      </div>
    </>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeContent />
    </Suspense>
  );
}
