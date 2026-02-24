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
          <a
            href={`${API_URL}/auth/google/login`}
            className="flex items-center justify-center gap-3 w-full rounded-xl border border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:text-white transition-all duration-200"
            style={{ padding: "12px 16px", fontSize: 14 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
