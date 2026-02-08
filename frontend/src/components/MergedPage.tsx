"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Script from "next/script";
import { useAnalysis } from "@/hooks/useAnalysis";
import ParticleCanvas from "@/components/ParticleCanvas";
import Nav from "@/components/Nav";
import GlassContainer from "@/components/GlassContainer";
import Header from "@/components/Header";
import TickerInput from "@/components/TickerInput";
import PhaseStatus from "@/components/PhaseStatus";
import AnalysisResults from "@/components/AnalysisResults";

/* ── Quick-try ticker chips ── */
const QUICK_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOG"];

/* ── How it works steps ── */
const STEPS = [
  {
    num: "01",
    title: "Enter a Ticker",
    desc: "Type any public company stock symbol to begin your research.",
  },
  {
    num: "02",
    title: "Gather SEC Data",
    desc: "We pull the latest 10-K and 10-Q filings directly from EDGAR.",
  },
  {
    num: "03",
    title: "Multi-LLM Analysis",
    desc: "Multiple AI models independently analyze the financials in parallel.",
  },
  {
    num: "04",
    title: "Consensus Report",
    desc: "Models debate and harmonize into one actionable evaluation.",
  },
];

/* ── Trust bar items ── */
const TRUST_ITEMS = [
  "SEC EDGAR Data",
  "5 LLM Models",
  "Real-Time Analysis",
  "No Login Required",
];

type Mode = "home" | "analyze";

interface Props {
  initialMode?: Mode;
  initialTicker?: string;
}

export default function MergedPage({ initialMode = "home", initialTicker = "" }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [transitioning, setTransitioning] = useState<"out" | "in" | null>(null);
  const [pendingTicker, setPendingTicker] = useState(initialTicker);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const { phase, ingestionData, analysisData, error, modelStatuses, run, reset } = useAnalysis();
  const isLoading = phase === "ingesting" || phase === "analyzing";

  const showHome = mode === "home" || transitioning === "out";
  const showAnalyze = mode === "analyze";

  const handleGoHome = useCallback(() => {
    reset();
    setMode("home");
    setTransitioning(null);
    setPendingTicker("");
    window.history.pushState(null, "", "/");
  }, [reset]);

  const handleEvaluate = useCallback((ticker: string) => {
    setPendingTicker(ticker);
    setTransitioning("out");

    setTimeout(() => {
      setMode("analyze");
      setTransitioning("in");
      window.history.pushState(null, "", `/analyze?ticker=${ticker}`);

      setTimeout(() => setTransitioning(null), 500);
    }, 500);
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const isAnalyze = window.location.pathname.startsWith("/analyze");
      setMode(isAnalyze ? "analyze" : "home");
      setTransitioning(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <>
      <ParticleCanvas
        phase={phase}
        progressBarRef={progressBarRef}
        particleCount={phase === "ingesting" || phase === "analyzing" ? 800 : 250}
      />

      <div className="relative z-10">
        <Nav onLogoClick={handleGoHome} />
      </div>

      {/* ── HOME VIEW ── */}
      {showHome && (
        <>
          {/* Dark hero section */}
          <div
            className={`relative z-10 min-h-screen flex flex-col ${transitioning === "out" ? "animate-fadeOutUp" : ""}`}
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", paddingTop: 80 }}
          >
            {/* Spline 3D Visual (left 40%) — fades out with hero */}
            <div className={`hidden lg:block absolute left-0 top-0 w-[40%] h-full z-0 pointer-events-auto ${transitioning === "out" ? "animate-fadeOut" : ""}`}>
              <Script
                type="module"
                src="https://cdn.spline.design/@splinetool/hana-viewer@1.2.44/hana-viewer.js"
                strategy="lazyOnload"
              />
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{
                  __html: '<hana-viewer url="https://prod.spline.design/8Y4PK1aVoV6bpVpU-ZkQ/scene.hanacode" style="width:100%;height:100%;display:block"></hana-viewer>',
                }}
              />
            </div>

            {/* Hero */}
            <section
              className="ml-auto flex flex-1 w-full lg:w-[60%] flex-col items-center lg:items-start justify-center text-center lg:text-left px-5 md:px-8 lg:px-12 lg:pr-16 pb-10 md:pb-15"
              style={{ maxWidth: 820 }}
            >
              {/* Badge */}
              <div
                className="animate-fadeInDown"
                style={{ marginBottom: 36 }}
              >
                <span
                  className="inline-flex items-center gap-2 rounded-full"
                  style={{
                    fontSize: 11,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                    color: "#3dd8e0",
                    border: "1px solid rgba(61, 216, 224, 0.2)",
                    background: "rgba(61, 216, 224, 0.08)",
                    padding: "8px 18px",
                  }}
                >
                  <span
                    className="animate-pulseDot inline-block rounded-full"
                    style={{ width: 6, height: 6, background: "#34d399" }}
                  />
                  Live &middot; Multi-LLM Analysis
                </span>
              </div>

              {/* Headline */}
              <h1
                className="animate-fadeInUp delay-0 font-[700] text-white text-[32px] md:text-[46px] lg:text-[58px]"
                style={{ lineHeight: 1.1 }}
              >
                Financial Intelligence,
              </h1>

              {/* Subhead */}
              <h2
                className="animate-fadeInUp delay-100 font-[300] text-[32px] md:text-[46px] lg:text-[58px]"
                style={{
                  lineHeight: 1.1,
                  marginTop: 8,
                  background: "linear-gradient(135deg, #3dd8e0, #7dd3fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Debated by AI.
              </h2>

              {/* Description */}
              <p
                className="animate-fadeInUp delay-200 font-[300] text-[15px] md:text-[17px]"
                style={{
                  lineHeight: 1.7,
                  marginTop: 28,
                  color: "rgba(255,255,255,0.45)",
                  maxWidth: 560,
                }}
              >
                Enter any ticker symbol and let multiple AI models independently
                analyze SEC filings, debate their findings, and deliver one
                actionable consensus report.
              </p>

              {/* Ticker Input */}
              <form
                className="animate-fadeInUp delay-300 w-full"
                style={{ marginTop: 48, maxWidth: 520 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.querySelector("input") as HTMLInputElement;
                  const ticker = input.value.trim().toUpperCase();
                  if (ticker) handleEvaluate(ticker);
                }}
              >
                <div
                  className="flex items-center gap-3 transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14,
                    padding: "6px 6px 6px 20px",
                    boxShadow: "0 20px 40px -12px rgba(0,0,0,0.5)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 16,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    $
                  </span>
                  <input
                    id="hero-ticker"
                    type="text"
                    placeholder="Enter ticker symbol..."
                    className="flex-1 bg-transparent outline-none placeholder:text-white/25"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 16,
                      letterSpacing: 1,
                      color: "white",
                    }}
                    onFocus={(e) => {
                      const container = e.currentTarget.parentElement!;
                      container.style.borderColor = "rgba(61,216,224,0.4)";
                      container.style.boxShadow = "0 20px 40px -12px rgba(0,0,0,0.5), 0 0 0 4px rgba(61,216,224,0.1)";
                      container.style.transform = "translateY(-2px)";
                    }}
                    onBlur={(e) => {
                      const container = e.currentTarget.parentElement!;
                      container.style.borderColor = "rgba(255,255,255,0.1)";
                      container.style.boxShadow = "0 20px 40px -12px rgba(0,0,0,0.5)";
                      container.style.transform = "translateY(0)";
                    }}
                  />
                  <button
                    type="submit"
                    className="cursor-pointer font-[500] text-white transition-all duration-200 hover:-translate-y-px"
                    style={{
                      fontSize: 15,
                      background: "#3dd8e0",
                      color: "#0a0e14",
                      borderRadius: 10,
                      padding: "12px 28px",
                      border: "none",
                    }}
                  >
                    Evaluate
                  </button>
                </div>

                {/* Quick-try hint */}
                <div
                  className="flex items-center justify-center gap-2"
                  style={{
                    marginTop: 14,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  <span>Quick try:</span>
                  {QUICK_TICKERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const input = document.querySelector<HTMLInputElement>("#hero-ticker");
                        if (input) { input.value = t; input.focus(); }
                      }}
                      className="cursor-pointer transition-colors duration-200 hover:text-[#3dd8e0]"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "2px 4px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </form>
            </section>
          </div>

          {/* White section: How It Works + Trust Bar */}
          <section
            className={`relative z-10 ${transitioning === "out" ? "animate-fadeOut" : ""}`}
            style={{
              background: "#ffffff",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
            }}
          >
            <div
              className="mx-auto w-full px-5 md:px-8 lg:px-12 pt-12 md:pt-20 pb-8 md:pb-10"
              style={{ maxWidth: 820 }}
            >
              <p
                className="text-center"
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  color: "rgba(10, 14, 20, 0.3)",
                  marginBottom: 40,
                }}
              >
                How it works
              </p>

              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                {STEPS.map((step) => (
                  <div
                    key={step.num}
                    style={{
                      background: "rgba(10, 14, 20, 0.03)",
                      border: "1px solid rgba(10, 14, 20, 0.08)",
                      borderRadius: 12,
                      padding: "24px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "rgba(61, 216, 224, 0.6)",
                        marginBottom: 12,
                      }}
                    >
                      {step.num}
                    </div>
                    <div
                      className="font-[600]"
                      style={{ fontSize: 14, marginBottom: 6, color: "#0a0e14" }}
                    >
                      {step.title}
                    </div>
                    <div
                      className="font-[300]"
                      style={{ fontSize: 12, color: "rgba(10, 14, 20, 0.55)", lineHeight: 1.5 }}
                    >
                      {step.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Bar */}
            <div
              className="mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-5 md:px-8 lg:px-12 pt-6 md:pt-8 pb-10 md:pb-15 mt-2 md:mt-5"
            >
              {TRUST_ITEMS.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "rgba(10, 14, 20, 0.3)",
                  }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: "rgba(61, 216, 224, 0.5)",
                    }}
                  />
                  {item}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── ANALYZE VIEW ── */}
      {showAnalyze && (
        <div className={`relative z-10 ${transitioning === "in" ? "animate-analyzeEnter" : ""}`}>
          <GlassContainer>
            <Header phase={phase} />
            <TickerInput onSubmit={run} disabled={isLoading} initialTicker={pendingTicker} />
            <PhaseStatus phase={phase} ingestionData={ingestionData} error={error} modelStatuses={modelStatuses} progressBarRef={progressBarRef} />
            {phase === "done" && analysisData && (
              <AnalysisResults data={analysisData} />
            )}
          </GlassContainer>
        </div>
      )}
    </>
  );
}
