import type { Phase } from "@/lib/types";

interface Props {
  phase: Phase;
}

export default function Header({ phase }: Props) {
  const isActive = phase !== "idle";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-light tracking-wider text-primary">
          THE KINETIC LEDGER
        </h1>
        <span className="text-xs font-mono text-muted">v2.0</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted uppercase">
          {phase === "idle" ? "ready" : phase}
        </span>
        <div
          className={`w-2 h-2 rounded-full ${
            isActive ? "bg-amber-400 animate-pulse" : "bg-sky-300"
          }`}
        />
      </div>
    </div>
  );
}
