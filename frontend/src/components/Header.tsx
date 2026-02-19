import Link from "next/link";

export default function Header() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="text-lg font-light tracking-wider text-primary">
        Agora - Financial Strenght Analisys
      </Link>
      <span className="text-xs font-mono text-muted">v2.0</span>
    </div>
  );
}
