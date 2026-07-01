"use client";

/**
 * Presentational building blocks for the analytics dashboard. These match the
 * existing admin design language: `glass-card` surfaces, brand-teal accents,
 * muted-foreground secondary text.
 */

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./charts";
import type { Delta } from "@/lib/api/analytics";

// ---------------------------------------------------------------------------
// KpiCard — headline metric with optional real (snapshot-derived) delta + spark.
// ---------------------------------------------------------------------------
export function KpiCard({
    label,
    value,
    sub,
    icon,
    delta,
    spark,
    accent = "brand",
    unavailable,
    unavailableReason,
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon?: React.ReactNode;
    delta?: Delta;
    spark?: number[];
    accent?: "brand" | "blue" | "purple" | "pink";
    unavailable?: boolean;
    unavailableReason?: string;
}) {
    const accentColor = {
        brand: "text-brand-400",
        blue: "text-accent-blue",
        purple: "text-accent-purple",
        pink: "text-accent-pink",
    }[accent];

    if (unavailable) {
        return (
            <div className="glass-card p-5 flex flex-col gap-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium text-sm">{label}</span>
                    {icon && <div className="p-2 bg-foreground/5 rounded-lg border border-(--card-border) opacity-50">{icon}</div>}
                </div>
                <UnavailablePill reason={unavailableReason} />
            </div>
        );
    }

    return (
        <div className="glass-card p-5 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl group-hover:bg-brand-500/20 transition-colors" />
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium text-sm">{label}</span>
                {icon && <div className={cn("p-2 bg-foreground/5 rounded-lg border border-(--card-border)", accentColor)}>{icon}</div>}
            </div>
            <div className="flex items-end justify-between gap-2">
                <h2 className="text-2xl font-bold text-foreground tracking-tight truncate">
                    {typeof value === "number" ? value.toLocaleString() : value}
                </h2>
                {spark && spark.length >= 2 && <Sparkline data={spark} className="h-7 w-20 shrink-0" />}
            </div>
            <div className="flex items-center gap-2 min-h-4">
                {delta && delta.available ? (
                    <DeltaBadge delta={delta} />
                ) : delta && !delta.available ? (
                    <span className="text-[11px] text-muted-foreground">Trend builds over time</span>
                ) : null}
                {sub && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
            </div>
        </div>
    );
}

function DeltaBadge({ delta }: { delta: Delta }) {
    const flat = delta.value === 0;
    const up = delta.value > 0;
    const Icon = flat ? ArrowRight : up ? ArrowUp : ArrowDown;
    const color = flat ? "text-muted-foreground" : up ? "text-brand-500" : "text-destructive";
    return (
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", color)}>
            <Icon className="h-3 w-3" />
            {delta.value > 0 ? "+" : ""}
            {delta.value.toLocaleString()}
            {delta.pct !== null && <span className="opacity-70">({delta.pct > 0 ? "+" : ""}{delta.pct.toFixed(0)}%)</span>}
            <span className="font-normal text-muted-foreground ml-0.5">vs prev</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Section — a titled band that groups related cards.
// ---------------------------------------------------------------------------
export function Section({
    title,
    description,
    icon,
    children,
    action,
}: {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                    {icon && <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500 border border-brand-500/20">{icon}</div>}
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

// ---------------------------------------------------------------------------
// Card — a plain content surface with an optional header.
// ---------------------------------------------------------------------------
export function Card({
    title,
    subtitle,
    right,
    children,
    className,
}: {
    title?: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("glass-card p-5 flex flex-col gap-4", className)}>
            {(title || right) && (
                <div className="flex items-start justify-between gap-3">
                    <div>
                        {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                    </div>
                    {right}
                </div>
            )}
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Stat — compact label/value pair used inside cards.
// ---------------------------------------------------------------------------
export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xl font-bold text-foreground tracking-tight">
                {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// EmptyState / UnavailablePill — honest "no data" and "not derivable" states.
// ---------------------------------------------------------------------------
export function EmptyState({ message, className }: { message: string; className?: string }) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
            <Info className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
        </div>
    );
}

export function UnavailablePill({ reason }: { reason?: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-muted-foreground border border-(--card-border)">
                <Info className="h-3 w-3" />
                Data Not Available
            </span>
            {reason && <span className="text-[11px] text-muted-foreground/80 leading-snug">{reason}</span>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// RankBadge — medal for top 3, muted rank number otherwise.
// ---------------------------------------------------------------------------
const MEDALS = ["🥇", "🥈", "🥉"];
export function RankBadge({ rank }: { rank: number }) {
    if (rank <= 3) return <span className="text-base leading-none">{MEDALS[rank - 1]}</span>;
    return <span className="text-xs font-mono text-muted-foreground">{rank}</span>;
}

// ---------------------------------------------------------------------------
// DataTable — small searchable table for leaderboards/rankings.
// ---------------------------------------------------------------------------
export interface Column<T> {
    key: string;
    header: string;
    render: (row: T, index: number) => React.ReactNode;
    align?: "left" | "right" | "center";
    className?: string;
}

export function DataTable<T>({
    columns,
    rows,
    searchable,
    searchKeys,
    searchPlaceholder = "Search…",
    pageSize = 10,
    emptyMessage = "No data available.",
}: {
    columns: Column<T>[];
    rows: T[];
    searchable?: boolean;
    searchKeys?: (row: T) => string;
    searchPlaceholder?: string;
    pageSize?: number;
    emptyMessage?: string;
}) {
    const [q, setQ] = useState("");
    const [limit, setLimit] = useState(pageSize);

    const filtered =
        searchable && q.trim() && searchKeys
            ? rows.filter(r => searchKeys(r).toLowerCase().includes(q.trim().toLowerCase()))
            : rows;
    const shown = filtered.slice(0, limit);

    return (
        <div className="flex flex-col gap-3">
            {searchable && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={q}
                        onChange={e => {
                            setQ(e.target.value);
                            setLimit(pageSize);
                        }}
                        placeholder={searchPlaceholder}
                        className="w-full rounded-xl bg-foreground/5 border border-(--card-border) pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                </div>
            )}
            {filtered.length === 0 ? (
                <EmptyState message={emptyMessage} />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-(--border) text-left">
                                {columns.map(c => (
                                    <th
                                        key={c.key}
                                        className={cn(
                                            "pb-2 px-2 text-xs font-medium text-muted-foreground",
                                            c.align === "right" && "text-right",
                                            c.align === "center" && "text-center",
                                        )}
                                    >
                                        {c.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--border)">
                            {shown.map((row, i) => (
                                <tr key={i} className="hover:bg-foreground/[0.03] transition-colors">
                                    {columns.map(c => (
                                        <td
                                            key={c.key}
                                            className={cn(
                                                "py-2.5 px-2 text-foreground",
                                                c.align === "right" && "text-right",
                                                c.align === "center" && "text-center",
                                                c.className,
                                            )}
                                        >
                                            {c.render(row, i)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {filtered.length > limit && (
                <button
                    onClick={() => setLimit(l => l + pageSize)}
                    className="mx-auto text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors"
                >
                    Show more ({filtered.length - limit} remaining)
                </button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// LazyMount — defer heavy sections until they scroll near the viewport, so the
// dashboard's many parallel fetches don't all fire on first paint.
// ---------------------------------------------------------------------------
export function LazyMount({ children, minHeight = 240 }: { children: React.ReactNode; minHeight?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        if (shown) return;
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") {
            // Old/SSR-less environments: reveal on the next microtask rather than
            // synchronously inside the effect body.
            queueMicrotask(() => setShown(true));
            return;
        }
        const io = new IntersectionObserver(
            entries => {
                if (entries.some(e => e.isIntersecting)) {
                    setShown(true);
                    io.disconnect();
                }
            },
            { rootMargin: "200px" },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [shown]);

    return (
        <div ref={ref} style={shown ? undefined : { minHeight }}>
            {shown ? children : null}
        </div>
    );
}
