"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MergedPage from "@/components/MergedPage";

function HomeRoute() {
  const searchParams = useSearchParams();
  const ticker = searchParams.get("ticker")?.toUpperCase() || "";
  return <MergedPage initialMode={ticker ? "analyze" : "home"} initialTicker={ticker} />;
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeRoute />
    </Suspense>
  );
}
