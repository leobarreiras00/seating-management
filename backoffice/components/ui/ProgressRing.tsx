/**
 * ProgressRing — anel de progresso em SVG (ex.: % de lugares validados num evento).
 * `percent` 0–100. O traço anima ao entrar (transição do stroke-dashoffset).
 */
export default function ProgressRing({
  percent,
  size = 64,
  stroke = 7,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = `ring-${size}-${stroke}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(p)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(139,92,246,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.8,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700 tabular">
        {label ?? `${Math.round(p)}%`}
      </div>
    </div>
  );
}
