import { cn } from "@/lib/cn";

function bandClass(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-fg-muted";
}

/** Lead score 0–100 as an SVG arc: <40 muted, 40–69 warning, ≥70 success. */
export function ScoreRing({ score, size = 32, className }: { score: number; size?: number; className?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = Math.max(2, size / 10);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Score ${value}`}
      className={cn("shrink-0", bandClass(value), className)}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {value > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-fg font-semibold tabular-nums"
        style={{ fontSize: Math.round(size * 0.34) }}
      >
        {value}
      </text>
    </svg>
  );
}
