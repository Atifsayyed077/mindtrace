"use client";

/* ── Hand-rolled SVG chart kit (no dependencies, premium look) ── */

export function LineChart({
  series, labels, height = 230, suffix = "",
}: {
  series: { name: string; color: string; fill?: string; values: (number | null)[] }[];
  labels: string[];
  height?: number;
  suffix?: string;
}) {
  const W = 640, H = height, P = { l: 34, r: 14, t: 16, b: 26 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = Math.max(labels.length, 2);
  const x = (i: number) => P.l + (i / (n - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / 100) * ih;

  const path = (vals: (number | null)[]) => {
    let d = "";
    let started = false;
    vals.forEach((v, i) => {
      if (v === null || v === undefined) return;
      d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      <defs>
        {series.map((s, i) => (
          s.fill ? (
            <linearGradient key={i} id={`fc-${i}-${s.name.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ) : null
        ))}
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={P.l} y1={y(g)} x2={W - P.r} y2={y(g)} stroke="#e7e3f4" strokeWidth="1" strokeDasharray="3 4" />
          <text x={P.l - 7} y={y(g) + 3.5} fontSize="9.5" fill="#8f96ad" textAnchor="end" fontFamily="system-ui">{g}{g === 100 ? suffix : ""}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const hasFill = !!s.fill;
        const d = path(s.values);
        return (
          <g key={i}>
            {hasFill && (
              <path d={areaPath(s.values, x, y, P.l + iw)} fill={`url(#fc-${i}-${s.name.replace(/\W/g, "")})`} />
            )}
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v, idx) => v === null ? null : (
              <g key={idx}>
                <circle cx={x(idx)} cy={y(v)} r="4.2" fill="#fff" stroke={s.color} strokeWidth="2.4" />
                <title>{`${labels[idx]}: ${v}${suffix}`}</title>
              </g>
            ))}
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="#5c6480" textAnchor="middle" fontFamily="system-ui">{l}</text>
      ))}
      <g>
        {series.map((s, i) => (
          <g key={i} transform={`translate(${P.l + i * 130}, 6)`}>
            <rect width="10" height="3" y="4" rx="1.5" fill={s.color} />
            <text x="14" y="8" fontSize="9.5" fill="#5c6480" fontFamily="system-ui">{s.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function areaPath(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number, xMax: number) {
  let d = "", first = true, firstX = 0, lastX = 0;
  vals.forEach((v, i) => {
    if (v === null || v === undefined) return;
    if (first) { d += `M${x(i)},${y(v)} `; firstX = x(i); first = false; }
    else d += `L${x(i)},${y(v)} `;
    lastX = x(i);
  });
  if (first) return "";
  const base = Math.min(y(0), 220);
  return `${d} L ${lastX},${base} L ${firstX},${base} Z`;
}

export function BarList({ data, max = 7 }: { data: { label: string; emoji?: string; value: number; color?: string }[]; max?: number }) {
  const top = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs font-medium text-ink-muted truncate">{d.emoji ?? ""} {d.label}</span>
          <div className="flex-1 h-6 bg-lav-50 rounded-lg overflow-hidden">
            <div className="h-full rounded-lg transition-all duration-700"
              style={{ width: `${Math.max(4, (d.value / top) * 100)}%`, background: `linear-gradient(90deg, ${d.color ?? "#a99bd6"}cc, ${d.color ?? "#a99bd6"})` }} />
          </div>
          <span className="w-9 text-right text-xs font-bold tabular text-ink">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * RadarChart is at the bottom; BarList in the middle.
 */
export function RadarChart({ axes, values, size = 300 }: { axes: string[]; values: number[]; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 44;
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = values.map((v, i) => pt(i, (Math.max(4, v) / 100) * R).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[380px] mx-auto" role="img">
      {[25, 50, 75, 100].map((g) => (
        <polygon key={g} points={axes.map((_, i) => pt(i, (g / 100) * R).join(",")).join(" ")}
          fill={g === 100 ? "#f3f0fc" : "none"} stroke="#e7e3f4" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e7e3f4" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="rgba(138,118,201,.28)" stroke="#8a76c9" strokeWidth="2.4" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, (Math.max(4, v) / 100) * R);
        return <circle key={i} cx={x} cy={y} r="3.4" fill="#fff" stroke="#8a76c9" strokeWidth="2" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text key={i} x={x} y={y} fontSize="10.5" fill="#3a4262" fontWeight="600" textAnchor="middle"
            dominantBaseline="middle" fontFamily="system-ui">
            {a.length > 16 ? a.slice(0, 15) + "…" : a}
          </text>
        );
      })}
    </svg>
  );
}
