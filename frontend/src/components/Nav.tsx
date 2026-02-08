"use client";

import Link from "next/link";

export default function Nav() {
  return (
    <nav
      className="flex w-full items-center justify-between px-5 md:px-8 lg:px-12 py-6"
    >
      <div className="flex items-center gap-6">
        <span
          className="font-[800] uppercase tracking-[2px] text-white"
          style={{ fontSize: 18, fontFamily: "var(--font-sans)" }}
        >
          Agora
        </span>
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
        <Link
          href="/analyze"
          className="text-white/45 transition-colors duration-200 hover:text-white/80"
          style={{ fontSize: 14 }}
        >
          Log in
        </Link>
        <Link
          href="/analyze"
          className="rounded-full bg-white text-[#0a0e14] font-[500] transition-opacity duration-200 hover:opacity-85"
          style={{ fontSize: 14, padding: "8px 20px" }}
        >
          Sign up
        </Link>
      </div>
    </nav>
  );
}
