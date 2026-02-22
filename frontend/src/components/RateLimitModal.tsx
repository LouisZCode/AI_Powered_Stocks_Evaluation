"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RateLimitModal({ isOpen, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-backdropIn"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
      onClick={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node))
          onClose();
      }}
    >
      <div
        ref={panelRef}
        className="rounded-2xl animate-fadeIn w-full max-w-sm mx-4 relative border border-white/[0.10]"
        style={{ padding: "32px 28px", background: "#0d1117" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "rgba(61, 216, 224, 0.1)",
              border: "1px solid rgba(61, 216, 224, 0.2)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3dd8e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09ZM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-5 mb-3">
          <h2 className="text-white font-[600] text-center" style={{ fontSize: 20 }}>
            Thank you for trying Agora Financials
          </h2>
          <p
            className="text-white/80 text-center"
            style={{ fontSize: 13, lineHeight: 1.6 }}
          >
            To keep on getting AI Powered financial analysis, plus Potential and Price analysis of public companies worldwide, please sign up.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 mt-8">
          <a
            href={`${API_URL}/auth/github/login`}
            className="flex items-center justify-center gap-3 w-full rounded-xl text-white/90 hover:text-white transition-all duration-200"
            style={{
              padding: "12px 16px",
              fontSize: 14,
              background: "#3dd8e0",
              color: "#0a0e14",
              fontWeight: 600,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
