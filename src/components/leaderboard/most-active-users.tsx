"use client";

/**
 * Most Active Users — a leaderboard tab (moved out of Founder Analytics).
 *
 * Ranks students by solving time (measured time spent solving
 * questions) over the selected window. Data comes from the `useActiveUsers`
 * hook (the local `/api/analytics/active-users` route), so unlike the FastAPI
 * ranking tabs it supports the full Exam / Class / Date filter set. Shows the
 * shared podium for the top 3, then a table with Class, Solving time and Solved
 * columns. Columns are client-sortable; the "Active days" column only makes
 * sense over the all-time window, so it hides when a date range is active.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useActiveUsers } from "@/components/analytics/data";
import type { Filters } from "@/lib/api/analytics";
import { humanDuration } from "@/components/analytics/format";
import { formatDate } from "@/lib/datetime";
import { Skeleton } from "@/components/ui/skeleton";
import { Podium, type PodiumEntry } from "./podium";

/** Human label for the effective window shown on the podium (IST). */
function rangeLabel(filters: Filters): string {
    const { from, to } = filters;
    if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
    if (from) return `Since ${formatDate(from)}`;
    if (to) return `Until ${formatDate(to)}`;
    return "Last 10 days";
}

const MEDALS = ["🥇", "🥈", "🥉"];

type LeaderRow = {
    user_id: string;
    name: string | null;
    exams: string[];
    class_name: string | null;
    time_solving_sec: number;
    solved: number;
    attempts: number;
    active_days: number;
    solved_physics: number;
    solved_chemistry: number;
    solved_biology: number;
    solved_maths: number;
};

type SortKey = "time_solving_sec" | "solved" | "active_days";

/** Small initials avatar for table rows. */
function RowAvatar({ name }: { name: string | null }) {
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-500/20 bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-400">
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

/** A right-aligned, clickable sortable column header. */
function SortHeader({
    label,
    col,
    sort,
    onSort,
    title,
}: {
    label: string;
    col: SortKey;
    sort: { key: SortKey; dir: "asc" | "desc" };
    onSort: (k: SortKey) => void;
    title?: string;
}) {
    const active = sort.key === col;
    return (
        <th className="pb-2 pt-3 px-4 font-medium text-right" title={title}>
            <button
                onClick={() => onSort(col)}
                className={`inline-flex items-center gap-1 ml-auto transition-colors cursor-pointer ${active ? "text-foreground" : "hover:text-foreground"}`}
            >
                {label}
                {active ? (
                    sort.dir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                ) : (
                    <ChevronDown className="h-3 w-3 opacity-20" />
                )}
            </button>
        </th>
    );
}

export function MostActiveUsers({ filters, hideActiveDays }: { filters: Filters; hideActiveDays?: boolean }) {
    const { data, error, loading } = useActiveUsers(filters);
    const leaderboard = (data?.leaderboard ?? []) as LeaderRow[];

    // Client-side sort. Default matches the server order (solving time desc).
    const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "time_solving_sec", dir: "desc" });
    const onSort = (key: SortKey) =>
        setSort(s => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

    if (loading) {
        return (
            <div className="glass-card p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3">
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <Skeleton className="h-7 w-7 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-40 rounded" />
                        </div>
                        <Skeleton className="h-4 w-16 rounded" />
                    </div>
                ))}
            </div>
        );
    }
    if (error) {
        return <div className="glass-card p-12 text-center text-muted-foreground">Could not load activity data.</div>;
    }
    if (leaderboard.length === 0) {
        return <div className="glass-card p-12 text-center text-muted-foreground">No solving activity for this selection.</div>;
    }

    // Podium always reflects the top 3 by solving time (not the
    // current table sort), so the "winners" stay stable while sorting the list.
    const podiumEntries: PodiumEntry[] = [...leaderboard]
        .sort((a, b) => b.time_solving_sec - a.time_solving_sec)
        .slice(0, 3)
        .map(u => ({ id: u.user_id, name: u.name, metric: humanDuration(u.time_solving_sec), metricUnit: "solving" }));

    const sorted = [...leaderboard].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        return sort.dir === "desc" ? bv - av : av - bv;
    });

    const colCount = hideActiveDays ? 4 : 5;

    return (
        <div className="flex flex-col gap-4">
            {/* Podium — top 3 by solving time */}
            <Podium
                top3={podiumEntries}
                title="Most Dedicated Student"
                subtitle={rangeLabel(filters)}
                showTrophy
            />

            <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                    {leaderboard.length.toLocaleString()} student{leaderboard.length === 1 ? "" : "s"} with activity
                </p>
            </div>

            {/* Full ranked table with Class, Solving time and Solved columns */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-(--border) text-left text-xs text-muted-foreground">
                                <th className="pb-2 pt-3 px-4 font-medium w-10 text-center">#</th>
                                <th className="pb-2 pt-3 px-4 font-medium">Student</th>
                                <th className="pb-2 pt-3 px-4 font-medium">Class</th>
                                <SortHeader label="Solving time" col="time_solving_sec" sort={sort} onSort={onSort} />
                                <SortHeader label="Solved" col="solved" sort={sort} onSort={onSort} />
                                {!hideActiveDays && (
                                    <SortHeader label="Active days" col="active_days" sort={sort} onSort={onSort} />
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--border)">
                            {sorted.map((u, i) => (
                                <tr key={u.user_id} className="hover:bg-foreground/[0.03]">
                                    <td className="py-2.5 px-4 text-center">
                                        {i < 3 ? (
                                            <span className="text-base leading-none">{MEDALS[i]}</span>
                                        ) : (
                                            <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <RowAvatar name={u.name} />
                                            <span className="block truncate font-medium text-foreground">{u.name || "Unknown"}</span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        {u.class_name ? (
                                            <span className="text-muted-foreground">{u.class_name}</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50">—</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold tabular-nums text-foreground">
                                        {humanDuration(u.time_solving_sec)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                        {u.solved.toLocaleString()}
                                    </td>
                                    {!hideActiveDays && (
                                        <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                            {u.active_days}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {sorted.length === 0 && (
                                <tr>
                                    <td colSpan={colCount} className="py-8 text-center text-muted-foreground">No students match this selection.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
