"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAuth } from "@/hooks/useAuth";
import { generateReport, deductTokens, deductDebateTokens, addToWatchlist, getWatchlist, removeFromWatchlist, searchAnalyzedTickers, reorderWatchlist } from "@/lib/api";
import type { WatchlistEntry } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import ParticleCanvas from "@/components/ParticleCanvas";
import Nav from "@/components/Nav";
import GlassContainer from "@/components/GlassContainer";
import Header from "@/components/Header";
import TickerInput from "@/components/TickerInput";
import PhaseStatus from "@/components/PhaseStatus";
import AnalysisResults from "@/components/AnalysisResults";
import RateLimitModal from "@/components/RateLimitModal";
import FeatureGateModal from "@/components/FeatureGateModal";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ── Quick-try ticker chips ── */
const QUICK_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOG"];

/* ── How it works steps ── */
const STEPS = [
  {
    num: "01",
    title: "Enter a Ticker",
    desc: "Any public company, any time.",
    icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  },
  {
    num: "02",
    title: "Gather SEC Data",
    desc: "Latest 10-K and 10-Q from EDGAR.",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
  {
    num: "03",
    title: "Multi-LLM Analysis",
    desc: "Multiple models analyze in parallel.",
    icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 4.932A2.25 2.25 0 0114.52 21H9.48a2.25 2.25 0 01-2.01-1.568L5 14.5m14 0H5",
  },
  {
    num: "04",
    title: "Consensus Report",
    desc: "One clear, actionable verdict.",
    icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
  },
];

/* ── Trust bar items ── */
const TRUST_ITEMS = [
  "SEC EDGAR Data",
  "5 LLM Models",
  "Real-Time Analysis",
  "No Login Required",
];

/* ── Sortable wrapper for watchlist rows ── */
function SortableItem({ id, children }: { id: string; children: (props: { listeners: ReturnType<typeof useSortable>["listeners"]; ref: (node: HTMLElement | null) => void; style: React.CSSProperties; attributes: ReturnType<typeof useSortable>["attributes"] }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return <>{children({ listeners, ref: setNodeRef, style, attributes })}</>;
}

/* ── Coming Soon placeholder for locked tabs ── */
function ComingSoonTab({ icon, title, desc, isLoggedIn }: { icon: string; title: string; desc: string; isLoggedIn: boolean }) {
  const [notifyChoice, setNotifyChoice] = useState<"yes" | "no" | null>(null);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <svg width={48} height={48} fill="none" viewBox="0 0 24 24">
        <path d={icon} stroke="#3dd8e0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontFamily: "var(--font-mono)" }}>
        {title}
      </p>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
        {desc}
      </p>

      <div className="mt-2 flex flex-col items-center gap-3">
        {!isLoggedIn ? (
          <p className="text-sm font-mono text-white/30">
            Please log in to see more information.
          </p>
        ) : notifyChoice === null ? (
          <>
            <p className="text-sm font-mono text-white/40 text-center">
              Want to be notified when this feature launches?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setNotifyChoice("yes")}
                className="px-5 py-2 rounded-lg text-sm font-mono font-medium transition-colors cursor-pointer"
                style={{ background: "rgba(61,216,224,0.12)", border: "1px solid rgba(61,216,224,0.25)", color: "#3dd8e0" }}
              >
                Yes, notify me
              </button>
              <button
                onClick={() => setNotifyChoice("no")}
                className="px-5 py-2 rounded-lg text-sm font-mono text-white/30 transition-colors cursor-pointer hover:text-white/50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                No thanks
              </button>
            </div>
          </>
        ) : notifyChoice === "yes" ? (
          <p className="text-sm font-mono text-[#3dd8e0]/70 flex items-center gap-2">
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            We&apos;ll let you know when it&apos;s ready!
          </p>
        ) : (
          <p className="text-sm font-mono text-white/25">
            No worries — check back soon!
          </p>
        )}
      </div>
    </div>
  );
}

type Mode = "home" | "analyze";
type Tab = "financial" | "potential" | "price" | "watchlist";

interface Props {
  initialMode?: Mode;
  initialTicker?: string;
}

export default function MergedPage({ initialMode = "home", initialTicker = "" }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [tab, setTab] = useState<Tab>("financial");
  const [transitioning, setTransitioning] = useState<"out" | "in" | null>(null);
  const [pendingTicker, setPendingTicker] = useState(initialTicker);
  const { phase, ingestionData, analysisData, harmonizationData, harmonizing, debateData, debating, debateError, currentDebateMetric, error, rateLimited, modelStatuses, run, harmonize, debate, reset, cancel, cancelModel, progressBarRef } = useAnalysis();
  const { user, isLoggedIn, refreshUser } = useAuth();
  const isLoading = phase === "ingesting" || phase === "analyzing";
  const [generatingReport, setGeneratingReport] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [watchlistData, setWatchlistData] = useState<WatchlistEntry[]>([]);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [tickerSearch, setTickerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // DnD sensors — require 5px movement before activating to allow clicks
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWatchlistData((prev) => {
      const oldIndex = prev.findIndex((e) => e.ticker === active.id);
      const newIndex = prev.findIndex((e) => e.ticker === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      // Fire-and-forget: persist order on server
      reorderWatchlist(reordered.map((e) => e.ticker)).catch(() => {
        // On failure, refetch from server
        getWatchlist().then(setWatchlistData).catch(() => {});
      });
      return reordered;
    });
  }, []);

  // Fetch watchlist when tab switches to watchlist
  useEffect(() => {
    if (tab === "watchlist" && isLoggedIn) {
      getWatchlist().then(setWatchlistData).catch(() => {});
    }
  }, [tab, isLoggedIn]);

  // Debounced search for analyzed tickers
  useEffect(() => {
    if (!searchOpen) return;
    const timer = setTimeout(() => {
      setSearchLoading(true);
      searchAnalyzedTickers(tickerSearch)
        .then((tickers) => {
          const watchlistTickers = new Set(watchlistData.map((e) => e.ticker));
          setSearchResults(tickers.filter((t) => !watchlistTickers.has(t)));
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [tickerSearch, searchOpen, watchlistData]);

  // Click-outside to close search dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Deduct tokens after analysis completes, then refresh balance
  useEffect(() => {
    if (phase === "done" && isLoggedIn && analysisData) {
      deductTokens(Object.keys(analysisData.evaluations))
        .then(() => refreshUser())
        .catch(() => refreshUser());
    }
  }, [phase, isLoggedIn, analysisData, refreshUser]);

  const handleFeatureGate = useCallback((msg: string) => {
    setGateMessage(msg);
  }, []);

  const handleRun = useCallback((ticker: string, models: string[]) => {
    setPendingTicker(ticker);
    run(ticker, models);
  }, [run]);

  const handleHarmonize = useCallback(() => {
    if (!analysisData) return;
    harmonize(pendingTicker, Object.keys(analysisData.evaluations));
  }, [harmonize, pendingTicker, analysisData]);

  const handleDebate = useCallback((models: string[], metrics: string[], rounds: number) => {
    debate(pendingTicker, models, metrics, rounds);
  }, [debate, pendingTicker]);

  // Post-deduct debate tokens after successful completion
  const lastDeductedDebateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!debating && debateData && !debateError && isLoggedIn) {
      // Build a unique key to prevent double-deduction on re-renders
      const key = `${debateData.models_used.join(",")}_${Object.keys(debateData.debate_results).length}_${debateData.rounds}`;
      if (lastDeductedDebateRef.current === key) return;
      lastDeductedDebateRef.current = key;
      deductDebateTokens(debateData.models_used, Object.keys(debateData.debate_results).length, debateData.rounds)
        .then(() => refreshUser())
        .catch(() => refreshUser());
    }
  }, [debating, debateData, debateError, isLoggedIn, refreshUser]);

  const handleReport = useCallback(async () => {
    if (!harmonizationData || generatingReport) return;
    setGeneratingReport(true);
    try {
      const models = harmonizationData.models_used;
      const debateResults = debateData?.debate_results ?? {};
      const positionChanges = debateData?.position_changes ?? [];
      const rounds = debateData?.rounds ?? 0;

      const blob = await generateReport(pendingTicker, models, debateResults, positionChanges, rounds, ingestionData?.domain);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `${pendingTicker}_FinancialReport_${date}_By_AgoraFinancials.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setGeneratingReport(false);
    }
  }, [harmonizationData, debateData, pendingTicker, generatingReport, ingestionData]);

  const showHome = mode === "home" || transitioning === "out";
  const showAnalyze = mode === "analyze";

  const handleGoHome = useCallback(() => {
    reset();
    setMode("home");
    setTransitioning(null);
    setPendingTicker("");
    window.history.pushState(null, "", "/");
  }, [reset]);

  const handleNewAnalysis = useCallback(() => {
    reset();
    setPendingTicker("");
    setGeneratingReport(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        <Nav onLogoClick={handleGoHome} user={user} />
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
                    autoComplete="off"
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

          {/* How It Works + Trust Bar */}
          <section
            className={`relative z-10 ${transitioning === "out" ? "animate-fadeOut" : ""}`}
            style={{
              background: "#ffffff",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
            }}
          >
            <div
              className="mx-auto w-full px-5 md:px-8 lg:px-16 pt-12 md:pt-20 pb-8 md:pb-10"
              style={{ maxWidth: 960 }}
            >
              <p
                className="text-center"
                style={{
                  fontSize: 14,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  color: "#000000",
                  marginBottom: 40,
                }}
              >
                How it works
              </p>

              {/* Cards — grid on mobile, flex with connectors on desktop */}
              <div className="grid grid-cols-2 lg:hidden gap-6">
                {STEPS.map((step) => (
                  <div
                    key={step.num}
                    className="flex flex-col items-center justify-center text-center"
                    style={{
                      background: "#1a1f2b",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 12,
                      padding: "24px 20px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 15,
                        color: "rgba(61, 216, 224, 0.6)",
                        marginBottom: 10,
                      }}
                    >
                      {step.num}
                    </div>
                    <svg width={28} height={28} fill="none" viewBox="0 0 24 24" style={{ marginBottom: 14 }}>
                      <path d={step.icon} stroke="#3dd8e0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }} />
                    </svg>
                    <div
                      className="font-[600]"
                      style={{ fontSize: 18, marginBottom: 6, color: "#ffffff" }}
                    >
                      {step.title}
                    </div>
                    <div
                      className="font-[300]"
                      style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.5)", lineHeight: 1.5 }}
                    >
                      {step.desc}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: flex row with dashed connectors */}
              <div className="hidden lg:flex items-stretch gap-8">
                {STEPS.map((step, i) => (
                  <div key={step.num} className="flex items-stretch" style={{ flex: 1 }}>
                    <div
                      className="flex flex-col items-center justify-center text-center"
                      style={{
                        flex: 1,
                        background: "#1a1f2b",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 12,
                        padding: "24px 20px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "rgba(61, 216, 224, 0.6)",
                          marginBottom: 10,
                        }}
                      >
                        {step.num}
                      </div>
                      <svg width={28} height={28} fill="none" viewBox="0 0 24 24" style={{ marginBottom: 14 }}>
                        <path d={step.icon} stroke="#3dd8e0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }} />
                      </svg>
                      <div
                        className="font-[600]"
                        style={{ fontSize: 18, marginBottom: 6, color: "#ffffff" }}
                      >
                        {step.title}
                      </div>
                      <div
                        className="font-[300]"
                        style={{ fontSize: 15, color: "rgba(255, 255, 255, 0.5)", lineHeight: 1.5 }}
                      >
                        {step.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Bar */}
            <div
              className="mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8 px-5 md:px-8 lg:px-12 pt-3 pb-8"
            >
              {TRUST_ITEMS.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 15,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#000000",
                  }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 6,
                      height: 6,
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
            {/* ── Tab Bar ── */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              {([
                { key: "financial", label: "Financial" },
                { key: "potential", label: "Potential" },
                { key: "price",     label: "Price" },
                { key: "watchlist", label: "My Watchlist" },
              ] as { key: Tab; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className="flex-1 cursor-pointer rounded-lg py-2 text-xs md:text-sm font-medium transition-all duration-200"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: 0.5,
                    background: tab === key ? "rgba(61,216,224,0.12)" : "transparent",
                    color: tab === key ? "#3dd8e0" : "rgba(255,255,255,0.35)",
                    border: tab === key ? "1px solid rgba(61,216,224,0.25)" : "1px solid transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            {tab === "financial" && (
              <>
                <Header />
                <TickerInput onSubmit={handleRun} disabled={isLoading} initialTicker={pendingTicker} isLoggedIn={isLoggedIn} onFeatureGate={handleFeatureGate} tokenBalance={user?.token_balance} />
                {!rateLimited && (
                  <PhaseStatus phase={phase} ingestionData={ingestionData} error={error} modelStatuses={modelStatuses} progressBarRef={progressBarRef} onCancel={cancel} onCancelModel={cancelModel} />
                )}
                {phase === "done" && analysisData && (
                  <AnalysisResults
                    data={analysisData}
                    onHarmonize={handleHarmonize}
                    harmonizing={harmonizing}
                    harmonizationData={harmonizationData}
                    onDebate={handleDebate}
                    debating={debating}
                    debateData={debateData}
                    debateError={debateError}
                    currentDebateMetric={currentDebateMetric}
                    onReport={handleReport}
                    generatingReport={generatingReport}
                    ticker={pendingTicker}
                    companyDomain={ingestionData?.domain ?? null}
                    dataRange={ingestionData?.earliest_quarter && ingestionData?.latest_quarter ? {
                      earliest: ingestionData.earliest_quarter,
                      latest: ingestionData.latest_quarter,
                      quarters: ingestionData.quarters_count ?? 0,
                      chunks: ingestionData.chunks,
                    } : null}
                    onNewAnalysis={handleNewAnalysis}
                    onAddToWatchlist={async () => {
                      try {
                        await addToWatchlist(pendingTicker);
                        setTab("watchlist");
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : "";
                        if (msg === "__WATCHLIST_LIMIT__") {
                          setGateMessage("Watchlist limit reached (10/10). Upgrade to add more.");
                        } else if (msg === "__ALREADY_IN_WATCHLIST__") {
                          setTab("watchlist");
                        }
                      }
                    }}
                    isLoggedIn={isLoggedIn}
                    onFeatureGate={handleFeatureGate}
                    modelStatuses={modelStatuses}
                    tokenBalance={user?.token_balance}
                  />
                )}
              </>
            )}

            {tab === "potential" && (
              <ComingSoonTab
                icon="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                title="Potential & Future Value"
                desc="Growth prospects, market position, and competitive moat analysis."
                isLoggedIn={isLoggedIn}
              />
            )}

            {tab === "price" && (
              <ComingSoonTab
                icon="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Price Evaluation"
                desc="Valuation metrics, fair value analysis, and price targets."
                isLoggedIn={isLoggedIn}
              />
            )}

            {tab === "watchlist" && (
              <div className="flex flex-col gap-3">
                {!isLoggedIn ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "var(--font-mono)" }}>
                      Sign in to use your watchlist
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Search bar */}
                    <div ref={searchRef} className="relative">
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: searchOpen ? "1px solid rgba(61,216,224,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                          <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search or add any ticker..."
                          value={tickerSearch}
                          onChange={(e) => { setTickerSearch(e.target.value.toUpperCase()); setSearchOpen(true); }}
                          onFocus={() => setSearchOpen(true)}
                          autoComplete="off"
                          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/25"
                          style={{ fontFamily: "var(--font-mono)", letterSpacing: 0.5 }}
                        />
                        {searchLoading && (
                          <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <circle cx={12} cy={12} r={10} stroke="rgba(61,216,224,0.3)" strokeWidth={2} />
                            <path d="M12 2a10 10 0 019.95 9" stroke="#3dd8e0" strokeWidth={2} strokeLinecap="round" />
                          </svg>
                        )}
                      </div>

                      {/* Dropdown */}
                      {searchOpen && (
                        <div
                          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-50"
                          style={{
                            background: "rgba(15,19,27,0.97)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                            maxHeight: 260,
                            overflowY: "auto",
                          }}
                        >
                          {/* Free-text add option */}
                          {tickerSearch.trim() &&
                            !searchResults.includes(tickerSearch.trim()) &&
                            !watchlistData.some((e) => e.ticker === tickerSearch.trim()) && (
                              <button
                                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors cursor-pointer border-b border-white/[0.06]"
                                onClick={async () => {
                                  const t = tickerSearch.trim();
                                  try {
                                    await addToWatchlist(t);
                                    setSearchOpen(false);
                                    setTickerSearch("");
                                    const fresh = await getWatchlist();
                                    setWatchlistData(fresh);
                                  } catch (e: unknown) {
                                    const msg = e instanceof Error ? e.message : "";
                                    if (msg === "__WATCHLIST_LIMIT__") {
                                      setSearchOpen(false);
                                      setGateMessage("Watchlist limit reached (10/10). Upgrade to add more.");
                                    } else if (msg === "__ALREADY_IN_WATCHLIST__") {
                                      setSearchOpen(false);
                                      setTickerSearch("");
                                    }
                                  }
                                }}
                              >
                                <span className="font-mono text-sm text-white">
                                  Add <span className="text-[#3dd8e0] font-semibold">{tickerSearch.trim()}</span> to watchlist
                                </span>
                                <span className="text-xs text-[#3dd8e0]/70 font-mono">+ Add</span>
                              </button>
                            )}
                          {searchResults.length > 0 ? (
                            searchResults.map((ticker) => (
                              <button
                                key={ticker}
                                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors cursor-pointer"
                                onClick={async () => {
                                  try {
                                    await addToWatchlist(ticker);
                                    setSearchResults((prev) => prev.filter((t) => t !== ticker));
                                    setSearchOpen(false);
                                    setTickerSearch("");
                                    const fresh = await getWatchlist();
                                    setWatchlistData(fresh);
                                  } catch (e: unknown) {
                                    const msg = e instanceof Error ? e.message : "";
                                    if (msg === "__WATCHLIST_LIMIT__") {
                                      setSearchOpen(false);
                                      setGateMessage("Watchlist limit reached (10/10). Upgrade to add more.");
                                    } else if (msg === "__ALREADY_IN_WATCHLIST__") {
                                      setSearchResults((prev) => prev.filter((t) => t !== ticker));
                                    }
                                  }
                                }}
                              >
                                <span className="font-mono text-sm text-white">{ticker}</span>
                                <span className="text-xs text-[#3dd8e0]/70 font-mono">+ Add</span>
                              </button>
                            ))
                          ) : !searchLoading && !tickerSearch.trim() ? (
                            <div className="px-3 py-3 text-center">
                              <p className="text-xs text-white/30 font-mono">Type a ticker to search or add</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-3" />
                    {/* Watchlist content */}
                    {watchlistData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <svg width={40} height={40} fill="none" viewBox="0 0 24 24" style={{ opacity: 0.25 }}>
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "var(--font-mono)" }}>
                          Your watchlist is empty
                        </p>
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, maxWidth: 280, textAlign: "center", lineHeight: 1.6 }}>
                          Search above or run an analysis to start tracking tickers.
                        </p>
                      </div>
                    ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-[24px_auto_40px_72px_72px_72px_1fr_32px] gap-x-4 items-center px-3 pb-1 border-b border-white/[0.06]">
                      <span />
                      <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono">Ticker</span>
                      <span />
                      <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono text-center">Financial</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono text-center">Potential</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/60 font-mono text-center">Price</span>
                      <span />
                      <span />
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setExpandedTicker(null)} onDragEnd={handleDragEnd}>
                    <SortableContext items={watchlistData.map((e) => e.ticker)} strategy={verticalListSortingStrategy}>
                    {watchlistData.map((entry) => {
                      // Extract average financial strength score across models
                      let avgScore: number | null = null;
                      if (entry.analyses && entry.analyses.length > 0) {
                        const scores = entry.analyses
                          .map((a) => {
                            const s = (a.analysis as Record<string, string>)?.financial_strenght;
                            const m = s?.match(/(\d+)/);
                            return m ? parseInt(m[1]) : null;
                          })
                          .filter((n): n is number => n !== null);
                        if (scores.length > 0) {
                          avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                        }
                      }

                      return (
                        <SortableItem key={entry.ticker} id={entry.ticker}>
                        {({ listeners, ref, style, attributes }) => (
                        <div ref={ref} style={style} {...attributes} data-watchlist-row className="flex flex-col gap-1.5">
                        <div
                          className="grid grid-cols-[24px_auto_40px_72px_72px_72px_1fr_32px] gap-x-4 items-center px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                        >
                          {/* Drag handle */}
                          <button
                            {...listeners}
                            className="flex items-center justify-center w-5 h-8 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors touch-none"
                            tabIndex={-1}
                          >
                            <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor">
                              <circle cx={5} cy={3} r={1.5} /><circle cx={11} cy={3} r={1.5} />
                              <circle cx={5} cy={8} r={1.5} /><circle cx={11} cy={8} r={1.5} />
                              <circle cx={5} cy={13} r={1.5} /><circle cx={11} cy={13} r={1.5} />
                            </svg>
                          </button>

                          {/* Ticker */}
                          <span className="font-mono text-sm font-semibold text-white">{entry.ticker}</span>

                          {/* Spacer between ticker and scores */}
                          <div />

                          {/* Financial gauge — clickable */}
                          <button
                            className="flex flex-col items-center justify-center cursor-pointer rounded-lg transition-colors hover:bg-white/[0.06]"
                            onClick={(e) => {
                              const isCollapsing = expandedTicker === entry.ticker;
                              if (isCollapsing) {
                                const row = (e.currentTarget as HTMLElement).closest("[data-watchlist-row]") as HTMLElement | null;
                                if (row) {
                                  const rectBefore = row.getBoundingClientRect();
                                  setExpandedTicker(null);
                                  requestAnimationFrame(() => {
                                    const rectAfter = row.getBoundingClientRect();
                                    window.scrollBy(0, rectAfter.top - rectBefore.top);
                                  });
                                } else {
                                  setExpandedTicker(null);
                                }
                              } else {
                                setExpandedTicker(entry.ticker);
                              }
                            }}
                            style={{ background: expandedTicker === entry.ticker ? "rgba(61,216,224,0.06)" : undefined }}
                          >
                            {avgScore !== null ? (
                              <ScoreGauge score={avgScore} size={48} />
                            ) : (
                              <div
                                className="flex flex-col items-center cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reset();
                                  setPendingTicker(entry.ticker);
                                  setTab("financial");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                <ScoreGauge empty size={48} />
                                <span className="text-[8px] text-[#3dd8e0]/40 font-mono -mt-0.5">run analysis</span>
                              </div>
                            )}
                          </button>

                          {/* Potential — clickable to tab */}
                          <button
                            className="flex flex-col items-center justify-center cursor-pointer rounded-lg transition-colors hover:bg-white/[0.06]"
                            onClick={() => { setTab("potential"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          >
                            <ScoreGauge empty size={48} />
                            <span className="text-[8px] text-[#3dd8e0]/40 font-mono -mt-0.5">coming soon</span>
                          </button>

                          {/* Price — clickable to tab */}
                          <button
                            className="flex flex-col items-center justify-center cursor-pointer rounded-lg transition-colors hover:bg-white/[0.06]"
                            onClick={() => { setTab("price"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          >
                            <ScoreGauge empty size={48} />
                            <span className="text-[8px] text-[#3dd8e0]/40 font-mono -mt-0.5">coming soon</span>
                          </button>

                          {/* Spacer */}
                          <div />

                          {/* Remove button */}
                          <button
                            onClick={async () => {
                              try {
                                await removeFromWatchlist(entry.ticker);
                                setWatchlistData((prev) => prev.filter((e) => e.ticker !== entry.ticker));
                              } catch {}
                            }}
                            className="flex items-center justify-center w-6 h-6 rounded-md text-white/15 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                          >
                            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* Expanded financial detail — metric gauge strip */}
                        {expandedTicker === entry.ticker && entry.analyses && entry.analyses.length > 0 && (() => {
                          const METRICS = [
                            { key: "revenue", label: "Revenue" },
                            { key: "net_income", label: "Net Inc." },
                            { key: "gross_margin", label: "Margin" },
                            { key: "operational_costs", label: "Op. Costs" },
                            { key: "cash_flow", label: "Cash Flow" },
                            { key: "quarterly_growth", label: "Q Growth" },
                            { key: "total_assets", label: "Assets" },
                            { key: "total_debt", label: "Debt" },
                          ] as const;
                          const ratingToScore = (r: string): number | null => {
                            const v = r?.toLowerCase();
                            if (v === "excellent") return 8;
                            if (v === "good") return 6;
                            if (v === "neutral") return 4;
                            if (v === "bad") return 2;
                            if (v === "horrible") return 1;
                            return null;
                          };
                          // Average each metric across all models
                          const metricScores = METRICS.map(({ key, label }) => {
                            const scores = entry.analyses!
                              .map((a) => ratingToScore((a.analysis as Record<string, string>)[key] ?? ""))
                              .filter((n): n is number => n !== null);
                            return {
                              label,
                              score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
                            };
                          });
                          return (
                            <div
                              className="flex flex-col gap-2 px-3 py-2 rounded-lg animate-fadeInUp"
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(61,216,224,0.12)",
                              }}
                            >
                              <div className="flex items-center justify-evenly">
                                {metricScores.map(({ label, score }) => (
                                  <div key={label} className="flex flex-col items-center gap-0.5">
                                    {score !== null ? (
                                      <ScoreGauge score={score} size={36} />
                                    ) : (
                                      <ScoreGauge empty size={36} />
                                    )}
                                    <span className="text-[9px] font-mono text-white whitespace-nowrap">{label}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-start gap-4 mt-3">
                                <div className="w-1/2">
                                  <span className="text-sm font-mono uppercase tracking-wider text-[#7dd3fc] mb-1 block text-center">EXECUTIVE SUMMARY</span>
                                  {(() => {
                                    const summary = entry.analyses!
                                      .map((a) => (a.analysis as Record<string, string>)?.overall_summary)
                                      .find((s) => s);
                                    return summary ? (
                                      <p className="text-base text-white leading-relaxed">{summary}</p>
                                    ) : null;
                                  })()}
                                </div>
                                <div className="w-1/2">
                                  {/* Reserved for future content */}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                        )}
                        </SortableItem>);
                    })}
                    </SortableContext>
                    </DndContext>
                  </>
                )}
                  </>
                )}
              </div>
            )}
          </GlassContainer>
        </div>
      )}

      <RateLimitModal isOpen={rateLimited} onClose={reset} />
      <FeatureGateModal isOpen={!!gateMessage} onClose={() => setGateMessage(null)} message={gateMessage ?? ""} user={user} />
    </>
  );
}
