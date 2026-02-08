"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MergedPage from "@/components/MergedPage";

function AnalyzeRoute() {
  const searchParams = useSearchParams();
  const ticker = searchParams.get("ticker")?.toUpperCase() || "";
  return <MergedPage initialMode="analyze" initialTicker={ticker} />;
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeRoute />
    </Suspense>
  );
}
