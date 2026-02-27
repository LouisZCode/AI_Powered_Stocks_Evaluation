"use client";

import { useState } from "react";
import AuthModal from "./AuthModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  onLogoClick?: () => void;
  user?: { name: string; email: string; tier: string; token_balance: number } | null;
}

export default function Nav({ onLogoClick, user }: Props) {
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);
  return (
    <>
      <nav
        className="flex w-full items-center justify-between px-5 md:px-8 lg:px-12 py-6"
      >
        <div className="flex items-center gap-6">
          <button
            onClick={(e) => {
              if (onLogoClick) {
                e.preventDefault();
                onLogoClick();
              } else {
                window.location.href = "/";
              }
            }}
            className="font-[800] uppercase tracking-[2px] text-white cursor-pointer"
            style={{ fontSize: 18, fontFamily: "var(--font-sans)", background: "none", border: "none", padding: 0 }}
          >
            Agora
          </button>
        </div>
        <div className="flex items-center gap-5">
          {user ? (
            <>
              <div className="flex flex-col items-end">
                <span className="text-white/70 text-sm font-mono">
                  {user.name}
                </span>
                <span className="text-sky-400/70 text-[11px] font-mono">
                  {user.token_balance} tokens
                </span>
              </div>
              <a
                href={`${API_URL}/auth/logout`}
                className="flex items-center justify-center rounded-full border border-white/[0.08] text-white/40 hover:text-white/80 hover:border-white/20 transition-all duration-200 cursor-pointer"
                style={{ width: 32, height: 32 }}
                title="Log out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </a>
            </>
          ) : (
            <>
              <button
                onClick={() => setAuthModal("login")}
                className="text-white/45 transition-colors duration-200 hover:text-white/80 cursor-pointer"
                style={{ fontSize: 14, background: "none", border: "none", padding: 0 }}
              >
                Log in
              </button>
              <button
                onClick={() => setAuthModal("signup")}
                className="rounded-full bg-white text-[#0a0e14] font-[500] transition-opacity duration-200 hover:opacity-85 cursor-pointer"
                style={{ fontSize: 14, padding: "8px 20px", border: "none" }}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </nav>

      <AuthModal
        isOpen={authModal !== null}
        onClose={() => setAuthModal(null)}
        mode={authModal ?? "login"}
      />
    </>
  );
}
