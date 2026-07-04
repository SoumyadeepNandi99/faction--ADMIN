"use client";

/**
 * Presentational building blocks for the analytics dashboard. These match the
 * existing admin design language: `glass-card` surfaces, brand-magenta accents,
 * muted-foreground secondary text.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./charts";

// ---------------------------------------------------------------------------
// InfoTip — a small "i" button that explains a metric. Clicking opens a centered
// modal (portaled to <body>) so the full text is never clipped by a card's
// overflow or the viewport edge. Closes on backdrop click, the X, or Escape.
// ---------------------------------------------------------------------------
export function InfoTip({ text, title, className }: { text: string; title?: string; className?: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <span className={cn("inline-flex shrink-0", className)}>
            <button
                type="button"
                aria-label={title ? `About ${title}` : "What is this metric?"}
                onClick={e => {
                    e.stopPropagation();
                    setOpen(true);
                }}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 hover:text-brand-500 hover:bg-foreground/5 transition-colors cursor-pointer"
            >
                <Info className="h-3.5 w-3.5" />
            </button>
            {open && typeof document !== "undefined" &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
                        onClick={() => setOpen(false)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            className="w-full max-w-sm rounded-2xl border border-(--card-border) bg-background p-5 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 text-foreground">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 border border-brand-500/20">
                                        <Info className="h-4 w-4" />
                                    </span>
                                    {title && <h4 className="font-semibold leading-tight">{title}</h4>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label="Close"
                                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                        </div>
                    </div>,
                    document.body,
                )}
        </span>
    );
}

// ---------------------------------------------------------------------------
// KpiCard — headline metric with an optional trailing sparkline + sub-label.
// ---------------------------------------------------------------------------
export function KpiCard({
    label,
    value,
    sub,
    icon,
    spark,
    accent = "brand",
    unavailable,
    unavailableReason,
    info,
}: {
    label: string;
    value: string | number;
    sub?: string;
    icon?: React.ReactNode;
    spark?: number[];
    accent?: "brand" | "blue" | "purple" | "pink";
    unavailable?: boolean;
    unavailableReason?: string;
    info?: string;
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
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted-foreground font-medium text-sm truncate">{label}</span>
                        {info && <InfoTip text={info} title={label} />}
                    </div>
                    {icon && <div className="p-2 bg-foreground/5 rounded-lg border border-(--card-border) opacity-50 shrink-0">{icon}</div>}
                </div>
                <UnavailablePill reason={unavailableReason} />
            </div>
        );
    }

    return (
        <div className="glass-card p-5 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl group-hover:bg-brand-500/20 transition-colors" />
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground font-medium text-sm truncate">{label}</span>
                    {info && <InfoTip text={info} title={label} />}
                </div>
                {icon && <div className={cn("p-2 bg-foreground/5 rounded-lg border border-(--card-border) shrink-0", accentColor)}>{icon}</div>}
            </div>
            <div className="flex items-end justify-between gap-2">
                <h2 className="text-2xl font-bold text-foreground tracking-tight truncate">
                    {typeof value === "number" ? value.toLocaleString() : value}
                </h2>
                {spark && spark.length >= 2 && <Sparkline data={spark} className="h-7 w-20 shrink-0" />}
            </div>
            <div className="flex items-center gap-2 min-h-4">
                {sub && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
            </div>
        </div>
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
    info,
}: {
    title?: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    info?: string;
}) {
    return (
        <div className={cn("glass-card p-5 flex flex-col gap-4", className)}>
            {(title || right) && (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                            {info && <InfoTip text={info} title={title} />}
                        </div>
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

/**
 * ErrorState — a real failure (DB unreachable, query error, or the analytics DB
 * connection not being configured yet). Distinct from EmptyState ("no rows") and
 * UnavailablePill ("not derivable from the schema").
 */
export function ErrorState({ code, detail, className }: { code?: string; detail?: string; className?: string }) {
    const notConfigured = code === "not_configured";
    return (
        <div className={cn("flex flex-col items-center justify-center gap-2 py-8 text-center", className)}>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/20">
                <Info className="h-3 w-3" />
                {notConfigured ? "Analytics DB not connected" : "Couldn't load"}
            </div>
            <p className="text-[11px] text-muted-foreground max-w-xs leading-snug">
                {notConfigured
                    ? "Set ANALYTICS_DATABASE_URL on the server (a read-only faction-backend connection) to populate this dashboard."
                    : detail || "The metric query failed. Try Refresh; if it persists, check the analytics DB connection."}
            </p>
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
