"use client";

import Link from "next/link";
import HomeParticleCanvas from "@/components/HomeParticleCanvas";

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

export default function HomePage() {
  return (
    <>
      <HomeParticleCanvas />

      {/* ── Section 1: DARK HERO ── */}
      <div
        className="relative z-10 min-h-screen flex flex-col"
        style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
      >
        {/* ── Nav ── */}
        <nav
          className="flex w-full items-center justify-between"
          style={{ padding: "24px 48px" }}
        >
          <span
            className="font-[800] uppercase tracking-[2px] text-white"
            style={{ fontSize: 18, fontFamily: "var(--font-sans)" }}
          >
            Agora
          </span>
          <div className="flex items-center gap-6">
            <Link
              href="/analyze"
              className="text-white/45 transition-colors duration-200 hover:text-white/80"
              style={{ fontSize: 14 }}
            >
              Analyze
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/45 transition-colors duration-200 hover:text-white/80"
              style={{ fontSize: 14 }}
            >
              GitHub
            </a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section
          className="mx-auto flex w-full flex-col items-center text-center"
          style={{ paddingTop: 100, paddingLeft: 48, paddingRight: 48, paddingBottom: 60, maxWidth: 820 }}
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
            className="animate-fadeInUp delay-0 font-[700] text-white"
            style={{ fontSize: 58, lineHeight: 1.1 }}
          >
            Financial Intelligence,
          </h1>

          {/* Subhead */}
          <h2
            className="animate-fadeInUp delay-100 font-[300]"
            style={{
              fontSize: 58,
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
            className="animate-fadeInUp delay-200 font-[300]"
            style={{
              fontSize: 17,
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
              if (ticker) {
                window.location.href = `/analyze?ticker=${ticker}`;
              }
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
                    window.location.href = `/analyze?ticker=${t}`;
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

      {/* ── Section 2: WHITE — How It Works ── */}
      <section
        className="relative z-10"
        style={{
          background: "#ffffff",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        }}
      >
        <div
          className="mx-auto w-full"
          style={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 48, paddingRight: 48, maxWidth: 820 }}
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
            className="grid"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
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

        {/* ── Trust Bar ── */}
        <div
          className="mx-auto flex items-center justify-center"
          style={{
            padding: "32px 48px",
            marginTop: 20,
            paddingBottom: 60,
            gap: 32,
          }}
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
  );
}
