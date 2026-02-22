"use client";

import { useState } from "react";
import AuthModal from "./AuthModal";

interface Props {
  onLogoClick?: () => void;
}

export default function Nav({ onLogoClick }: Props) {
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
          <div className="hidden md:flex items-center gap-5">
            {["Personal", "Business", "Company"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-white/45 transition-colors duration-200 hover:text-white/80"
                style={{ fontSize: 14 }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-5">
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
