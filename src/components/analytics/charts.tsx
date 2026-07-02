"use client";

/**
 * Hand-rolled, dependency-free SVG charts. We deliberately avoid pulling in a
 * charting library: these are small, theme-aware (they inherit `currentColor`
 * and use the app's brand CSS variables), and responsive via `viewBox`.
 */

import React from "react";

const BRAND = "var(--color-brand-500)";
const PALETTE = [
    "var(--color-brand-500)",
    "var(--color-accent-blue)",
    "var(--color-accent-purple)",
    "var(--color-accent-pink)",
    "var(--color-brand-300)",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#6366f1",
    "#41d6e0",
];

function niceMax(v: number): number {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / mag;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
}

// ---------------------------------------------------------------------------
// Sparkline — tiny inline trend line for KPI cards.
// ---------------------------------------------------------------------------
export function Sparkline({ data, className, color = BRAND }: { data: number[]; className?: string; color?: string }) {
    if (data.length < 2) return null;
    const w = 100;
    const h = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const last = data[data.length - 1];
    const first = data[0];
    const up = last >= first;
    const stroke = color === BRAND ? (up ? "var(--color-brand-500)" : "var(--color-destructive)") : color;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// AreaChart — filled trend, used for the registration/growth series.
// ---------------------------------------------------------------------------
export function AreaChart({
    points,
    labels,
    height = 200,
    color = BRAND,
}: {
    points: number[];
    labels?: string[];
    height?: number;
    color?: string;
}) {
    // Hooks must run unconditionally — keep useId above any early return.
    const uid = React.useId().replace(/:/g, "");
    if (points.length < 2) return null;
    const w = 600;
    const h = height;
    const pad = { top: 12, right: 8, bottom: 22, left: 34 };
    const iw = w - pad.left - pad.right;
    const ih = h - pad.top - pad.bottom;
    const max = niceMax(Math.max(...points));
    const x = (i: number) => pad.left + (i / (points.length - 1)) * iw;
    const y = (v: number) => pad.top + ih - (v / max) * ih;
    const line = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const area = `${pad.left},${pad.top + ih} ${line} ${pad.left + iw},${pad.top + ih}`;
    const gridVals = [0, 0.5, 1].map(f => Math.round(max * f));
    const nLabels = labels ? Math.min(6, labels.length) : 0;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
            <defs>
                <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            {gridVals.map((gv, i) => {
                const gy = y(gv);
                return (
                    <g key={i}>
                        <line x1={pad.left} y1={gy} x2={pad.left + iw} y2={gy} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />
                        <text x={pad.left - 6} y={gy + 3} textAnchor="end" fontSize={9} fill="var(--color-muted-foreground)">
                            {gv.toLocaleString()}
                        </text>
                    </g>
                );
            })}
            <polygon points={area} fill={`url(#area-${uid})`} />
            <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {labels &&
                nLabels > 1 &&
                Array.from({ length: nLabels }).map((_, k) => {
                    const idx = Math.round((k / (nLabels - 1)) * (labels.length - 1));
                    return (
                        <text key={k} x={x(idx)} y={h - 6} textAnchor="middle" fontSize={9} fill="var(--color-muted-foreground)">
                            {labels[idx]}
                        </text>
                    );
                })}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// BarChart — vertical bars (e.g. hour-of-day distribution).
// ---------------------------------------------------------------------------
export function BarChart({
    data,
    height = 200,
    color = BRAND,
    labelEvery = 1,
}: {
    data: { label: string; count: number }[];
    height?: number;
    color?: string;
    labelEvery?: number;
}) {
    if (!data.length) return null;
    const w = 600;
    const h = height;
    const pad = { top: 12, right: 8, bottom: 22, left: 34 };
    const iw = w - pad.left - pad.right;
    const ih = h - pad.top - pad.bottom;
    const max = niceMax(Math.max(...data.map(d => d.count), 0));
    const bw = iw / data.length;
    const y = (v: number) => pad.top + ih - (v / max) * ih;
    const gridVals = [0, 0.5, 1].map(f => Math.round(max * f));

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
            {gridVals.map((gv, i) => (
                <g key={i}>
                    <line x1={pad.left} y1={y(gv)} x2={pad.left + iw} y2={y(gv)} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />
                    <text x={pad.left - 6} y={y(gv) + 3} textAnchor="end" fontSize={9} fill="var(--color-muted-foreground)">
                        {gv.toLocaleString()}
                    </text>
                </g>
            ))}
            {data.map((d, i) => {
                const bh = ih - (y(d.count) - pad.top);
                return (
                    <g key={i}>
                        <rect x={pad.left + i * bw + bw * 0.15} y={y(d.count)} width={bw * 0.7} height={Math.max(0, bh)} rx={2} fill={color} opacity={0.85}>
                            <title>{`${d.label}: ${d.count.toLocaleString()}`}</title>
                        </rect>
                        {i % labelEvery === 0 && (
                            <text x={pad.left + i * bw + bw / 2} y={h - 6} textAnchor="middle" fontSize={9} fill="var(--color-muted-foreground)">
                                {d.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// ---------------------------------------------------------------------------
// HBarList — horizontal bars with labels & values (rankings, distributions).
// ---------------------------------------------------------------------------
export function HBarList({
    data,
    max: fixedMax,
    colorByIndex = false,
    valueFormatter = (v: number) => v.toLocaleString(),
}: {
    data: { label: string; count: number }[];
    max?: number;
    colorByIndex?: boolean;
    valueFormatter?: (v: number) => string;
}) {
    if (!data.length) return null;
    const max = fixedMax ?? Math.max(...data.map(d => d.count), 1);
    return (
        <div className="flex flex-col gap-2.5">
            {data.map((d, i) => (
                <div key={`${d.label}-${i}`} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
                        {d.label}
                    </span>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-foreground/5">
                        <div
                            className="h-full rounded-md transition-all"
                            style={{
                                width: `${Math.max(2, (d.count / max) * 100)}%`,
                                background: colorByIndex ? PALETTE[i % PALETTE.length] : BRAND,
                                opacity: 0.85,
                            }}
                        />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs font-semibold text-foreground tabular-nums">
                        {valueFormatter(d.count)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// DonutChart — categorical share with a centred total & legend.
// ---------------------------------------------------------------------------
export function DonutChart({ data, size = 160 }: { data: { label: string; count: number }[]; size?: number }) {
    const total = data.reduce((a, b) => a + b.count, 0);
    if (total === 0) return null;
    const r = size / 2;
    const stroke = size * 0.16;
    const radius = r - stroke / 2;
    const circ = 2 * Math.PI * radius;
    // Precompute each segment's start offset from the running sum of prior fracs
    // (kept pure — no render-scope accumulator to reassign).
    const segments = data.map((d, i) => {
        const frac = d.count / total;
        const priorFrac = data.slice(0, i).reduce((s, x) => s + x.count, 0) / total;
        return { dash: frac * circ, offset: priorFrac * circ, color: PALETTE[i % PALETTE.length], ...d, frac };
    });

    return (
        <div className="flex flex-wrap items-center gap-5">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
                <circle cx={r} cy={r} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={stroke} opacity={0.4} />
                {segments.map((s, i) => (
                    <circle
                        key={i}
                        cx={r}
                        cy={r}
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={stroke}
                        strokeDasharray={`${s.dash} ${circ - s.dash}`}
                        strokeDashoffset={-s.offset}
                        strokeLinecap="butt"
                    >
                        <title>{`${s.label}: ${s.count.toLocaleString()} (${Math.round(s.frac * 100)}%)`}</title>
                    </circle>
                ))}
                <text x={r} y={r} className="rotate-90" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.16} fontWeight={700} fill="var(--color-foreground)" transform={`rotate(90 ${r} ${r})`}>
                    {total.toLocaleString()}
                </text>
            </svg>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {segments.slice(0, 8).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={s.label}>
                            {s.label}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">{s.count.toLocaleString()}</span>
                        <span className="w-9 text-right text-muted-foreground tabular-nums">{Math.round(s.frac * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// ProgressBar — single labelled ratio.
// ---------------------------------------------------------------------------
export function ProgressBar({ value, max = 100, color = BRAND }: { value: number; max?: number; color?: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Heatmap — weekday × hour grid (registration activity).
// ---------------------------------------------------------------------------
export function Heatmap({ grid, rows, cols }: { grid: number[][]; rows: string[]; cols: string[] }) {
    const flat = grid.flat();
    const max = Math.max(...flat, 1);
    return (
        <div className="overflow-x-auto">
            <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
                <div />
                {cols.map((c, i) => (
                    <div key={i} className="px-0.5 text-center text-[9px] text-muted-foreground">
                        {i % 2 === 0 ? c : ""}
                    </div>
                ))}
                {rows.map((rlabel, r) => (
                    <React.Fragment key={r}>
                        <div className="pr-2 text-right text-[10px] leading-4 text-muted-foreground">{rlabel}</div>
                        {cols.map((_, c) => {
                            const v = grid[r]?.[c] ?? 0;
                            const intensity = v / max;
                            return (
                                <div
                                    key={c}
                                    className="aspect-square min-w-3 rounded-[3px]"
                                    style={{ background: v === 0 ? "var(--color-muted)" : `color-mix(in srgb, var(--color-brand-500) ${Math.round(15 + intensity * 85)}%, transparent)` }}
                                    title={`${rlabel} ${cols[c]}: ${v}`}
                                />
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
