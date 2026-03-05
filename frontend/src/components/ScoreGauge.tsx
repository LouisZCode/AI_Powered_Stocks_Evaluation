"use client";

interface Props {
  /** Score from 0 to 8 (maps to needle position on semicircle) */
  score: number;
  /** Max score, default 8 */
  max?: number;
  /** SVG size in px, default 64 */
  size?: number;
}

export default function ScoreGauge({ score, max = 8, size = 64 }: Props) {
  const ratio = Math.max(0, Math.min(score / max, 1));
  // Needle angle: 0 = left (180°), 1 = right (0°). SVG rotation from -90°.
  const needleAngle = -90 + ratio * 180;

  const cx = 50;
  const cy = 52;
  const r = 38;

  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 62" fill="none">
      {/* Gradient arc */}
      <defs>
        <linearGradient id={`gauge-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="25%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="75%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Background arc (subtle) */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      {/* Colored arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={`url(#gauge-grad-${size})`}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      {/* Needle */}
      <g transform={`rotate(${needleAngle}, ${cx}, ${cy})`}>
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy - r + 8}
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={3} fill="white" />
      </g>
    </svg>
  );
}
