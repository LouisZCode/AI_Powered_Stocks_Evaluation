"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";
import { useAuth } from "@/hooks/useAuth";
import { TIERS, TOKEN_COSTS, RUN_EXAMPLES, FAQ_ITEMS } from "@/lib/pricing";

/* ─── Simplified idle-only particle background ─── */
function PricingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const COUNT = 250;
    const CONNECTION_DIST = 70;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouse);

    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.3) * 0.5,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.fillStyle = "rgba(5, 10, 18, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.phase += 0.01;
        p.x += p.vx;
        p.y += p.vy + Math.sin(p.phase) * 0.3;

        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          p.x += (dx / dist) * 2;
          p.y += (dy / dist) * 2;
        }

        // Wrap around
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.y > canvas.height + 10) p.y = -10;
        if (p.y < -10) p.y = canvas.height + 10;

        // Trail
        const gradient = ctx.createLinearGradient(p.x - p.vx * 8, p.y, p.x, p.y);
        const color = `rgba(125, 211, 252, ${0.6 * (p.size / 2.5)})`;
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, color);
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 8, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = p.size;
        ctx.stroke();

        // Particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Connections
        for (let j = i + 1; j < COUNT; j++) {
          const q = particles[j];
          const cdx = p.x - q.x;
          const cdy = p.y - q.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CONNECTION_DIST) {
            const alpha = (1 - cdist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "auto" }}
    />
  );
}

/* ─── FAQ Accordion Item ─── */
function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left cursor-pointer"
      >
        <span className="text-white/90 font-[500]" style={{ fontSize: 15 }}>
          {question}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <p className="pb-5 text-white/60 animate-fadeIn" style={{ fontSize: 13, lineHeight: 1.7 }}>
          {answer}
        </p>
      )}
    </div>
  );
}

/* ─── Main Pricing Page ─── */
export default function PricingPage() {
  const { user } = useAuth();

  const scrollToTiers = useCallback(() => {
    document.getElementById("tiers")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="relative min-h-screen">
      <PricingParticles />

      {/* Nav */}
      <div className="relative z-10">
        <Nav user={user} />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8 pb-24 animate-fadeIn">
        {/* Hero */}
        <section className="pt-12 pb-16 text-center">
          <h1
            className="text-white font-[700] tracking-tight"
            style={{ fontSize: "clamp(28px, 5vw, 48px)" }}
          >
            Simple, transparent pricing
          </h1>
          <p
            className="mt-4 text-white/50 max-w-lg mx-auto"
            style={{ fontSize: 16, lineHeight: 1.7 }}
          >
            Pay only for what you use. Every plan includes multi-LLM analysis
            powered by the best models available.
          </p>
        </section>

        {/* Tier Cards — top row: 4 plans */}
        <section id="tiers" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {TIERS.filter((t) => t.id !== "enterprise").map((tier) => {
            const isCurrent = user?.tier === tier.id;
            return (
              <div
                key={tier.id}
                className={`glass-card rounded-2xl p-5 flex flex-col ${
                  tier.highlighted ? "border-[#3dd8e0]/40" : ""
                }`}
                style={tier.highlighted ? { borderColor: "rgba(61, 216, 224, 0.4)" } : undefined}
              >
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-white font-[600]" style={{ fontSize: 20 }}>
                    {tier.name}
                  </h3>
                  {tier.badge && (
                    <span
                      className="rounded-full font-[600] text-[#0a0e14]"
                      style={{ fontSize: 11, padding: "3px 10px", background: "#3dd8e0" }}
                    >
                      {tier.badge}
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="rounded-full font-[500]"
                      style={{ fontSize: 11, padding: "3px 10px", color: "#3dd8e0", border: "1px solid rgba(61, 216, 224, 0.3)" }}
                    >
                      Current Plan
                    </span>
                  )}
                </div>

                <div className="mb-5">
                  <span className="text-white font-[700] font-mono" style={{ fontSize: 30 }}>
                    {tier.price}
                  </span>
                  {tier.tokensNum !== null && (
                    <span className="text-white/40 ml-1" style={{ fontSize: 14 }}>/mo</span>
                  )}
                  <p className="text-white/40 mt-1 font-mono" style={{ fontSize: 13 }}>
                    {tier.tokens}
                  </p>
                </div>

                <ul className="flex-1 space-y-2.5 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                        <path d="M3 8.5l3 3 7-7" stroke="#3dd8e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-white/60" style={{ fontSize: 13 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl font-[500] cursor-default"
                    style={{ padding: "11px 0", fontSize: 14, color: "#3dd8e0", border: "1px solid rgba(61, 216, 224, 0.3)", background: "transparent" }}
                  >
                    Current Plan
                  </button>
                ) : tier.id === "free" && !user ? (
                  <a
                    href="/"
                    className="block w-full text-center rounded-xl font-[500] transition-opacity hover:opacity-85"
                    style={{ padding: "11px 0", fontSize: 14, color: "#0a0e14", background: "#3dd8e0" }}
                  >
                    Get Started
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full rounded-xl font-[500] text-white/30 cursor-default"
                    style={{ padding: "11px 0", fontSize: 14, border: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* Bottom row: Enterprise + Buy Individual Tokens */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20 max-w-3xl mx-auto">
          {/* Enterprise */}
          {(() => {
            const tier = TIERS.find((t) => t.id === "enterprise")!;
            const isCurrent = user?.tier === tier.id;
            return (
              <div className="glass-card rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-white font-[600]" style={{ fontSize: 20 }}>
                    {tier.name}
                  </h3>
                  {isCurrent && (
                    <span
                      className="rounded-full font-[500]"
                      style={{ fontSize: 11, padding: "3px 10px", color: "#3dd8e0", border: "1px solid rgba(61, 216, 224, 0.3)" }}
                    >
                      Current Plan
                    </span>
                  )}
                </div>
                <div className="mb-5">
                  <span className="text-white font-[700] font-mono" style={{ fontSize: 30 }}>
                    {tier.price}
                  </span>
                  <p className="text-white/40 mt-1 font-mono" style={{ fontSize: 13 }}>
                    {tier.tokens}
                  </p>
                </div>
                <ul className="flex-1 space-y-2.5 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                        <path d="M3 8.5l3 3 7-7" stroke="#3dd8e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-white/60" style={{ fontSize: 13 }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="w-full rounded-xl font-[500] text-white/30 cursor-default"
                  style={{ padding: "11px 0", fontSize: 14, border: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}
                >
                  Contact Us
                </button>
              </div>
            );
          })()}

          {/* Buy Individual Tokens */}
          <div className="glass-card rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white font-[600]" style={{ fontSize: 20 }}>
                Buy Tokens
              </h3>
            </div>
            <div className="mb-5">
              <span className="text-white font-[700] font-mono" style={{ fontSize: 30 }}>
                $1
              </span>
              <span className="text-white/40 ml-1" style={{ fontSize: 14 }}>
                / 10 tokens
              </span>
              <p className="text-white/40 mt-1 font-mono" style={{ fontSize: 13 }}>
                No subscription needed
              </p>
            </div>
            <ul className="flex-1 space-y-2.5 mb-6">
              {["Top up anytime", "No monthly commitment", "Tokens never expire", "Works with any plan"].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
                    <path d="M3 8.5l3 3 7-7" stroke="#3dd8e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-white/60" style={{ fontSize: 13 }}>{f}</span>
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full rounded-xl font-[500] text-white/30 cursor-default"
              style={{ padding: "11px 0", fontSize: 14, border: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}
            >
              Coming Soon
            </button>
          </div>
        </section>

        {/* Token Costs */}
        <section className="mb-20">
          <h2 className="text-white font-[600] mb-6 text-center" style={{ fontSize: 24 }}>
            Token costs
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-white/40 font-[500] p-4">Action</th>
                  <th className="text-left text-white/40 font-[500] p-4">Cost</th>
                  <th className="text-left text-white/40 font-[500] p-4 hidden sm:table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                {TOKEN_COSTS.map((row) => (
                  <tr key={row.action} className="border-b border-white/[0.04]">
                    <td className="p-4 text-white/80">{row.action}</td>
                    <td className="p-4 text-sky-300 font-mono">{row.cost}</td>
                    <td className="p-4 text-white/40 hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Run Examples */}
        <section className="mb-20">
          <h2 className="text-white font-[600] mb-2 text-center" style={{ fontSize: 24 }}>
            Example runs
          </h2>
          <p className="text-white/40 text-center mb-8" style={{ fontSize: 14 }}>
            How many tokens does a typical analysis cost?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {RUN_EXAMPLES.map((ex) => (
              <div key={ex.label} className="glass-card rounded-2xl p-6 text-center">
                <p className="text-white/50 font-[500] mb-2" style={{ fontSize: 13 }}>
                  {ex.label}
                </p>
                <p className="text-white font-[700] font-mono mb-3" style={{ fontSize: 32 }}>
                  {ex.tokens}
                </p>
                <p className="text-white/40" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {ex.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20 max-w-2xl mx-auto">
          <h2 className="text-white font-[600] mb-8 text-center" style={{ fontSize: 24 }}>
            Frequently asked questions
          </h2>
          <div className="glass-card rounded-2xl px-6">
            {FAQ_ITEMS.map((item) => (
              <FaqAccordion key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center pb-8">
          {user ? (
            <a
              href="/"
              className="inline-block rounded-full font-[500] transition-opacity hover:opacity-85"
              style={{
                padding: "14px 36px",
                fontSize: 15,
                color: "#0a0e14",
                background: "#3dd8e0",
              }}
            >
              Start analyzing
            </a>
          ) : (
            <a
              href="/"
              className="inline-block rounded-full font-[500] transition-opacity hover:opacity-85"
              style={{
                padding: "14px 36px",
                fontSize: 15,
                color: "#0a0e14",
                background: "#3dd8e0",
              }}
            >
              Sign up free
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
