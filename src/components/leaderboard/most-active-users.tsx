"use client";

/**
 * Most Active Users — a leaderboard tab (moved out of Founder Analytics).
 *
 * Ranks students by productive solving time (measured time spent solving
 * questions) over the
 * selected window. Data comes from the `useActiveUsers` hook (the local
 * `/api/analytics/active-users` route), so unlike the FastAPI ranking tabs it
 * supports the full Exam / Class / Date filter set. Shows the shared podium for
 * the top 3, then a table with per-row Exam and P/C/B/M (per-subject solved)
 * columns.
 */

import { useActiveUsers } from "@/components/analytics/data";
import type { Filters } from "@/lib/api/analytics";
import { humanDuration } from "@/components/analytics/format";
import { formatExamType } from "@/lib/exam-types";
import { Skeleton } from "@/components/ui/skeleton";
import { Podium, type PodiumEntry } from "./podium";

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

/** Compact per-subject solved cell: P C B M with dimmed zeros. */
function SubjectCounts({ u }: { u: LeaderRow }) {
    const cells: { k: string; v: number }[] = [
        { k: "P", v: u.solved_physics },
        { k: "C", v: u.solved_chemistry },
        { k: "B", v: u.solved_biology },
        { k: "M", v: u.solved_maths },
    ];
    return (
        <div className="flex items-center justify-end gap-1.5 tabular-nums">
            {cells.map(c => (
                <span
                    key={c.k}
                    title={{ P: "Physics", C: "Chemistry", B: "Biology", M: "Maths" }[c.k]}
                    className={`inline-flex min-w-[2.25rem] items-center justify-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs ${c.v > 0 ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold" : "text-muted-foreground/40"}`}
                >
                    <span className="font-bold">{c.k}</span>
                    {c.v}
                </span>
            ))}
        </div>
    );
}

/** Small initials avatar for table rows. */
function RowAvatar({ name }: { name: string | null }) {
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-500/20 bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-400">
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

export function MostActiveUsers({ filters }: { filters: Filters }) {
    const { data, error, loading } = useActiveUsers(filters);
    const leaderboard = (data?.leaderboard ?? []) as LeaderRow[];

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

    const podiumEntries: PodiumEntry[] = leaderboard.slice(0, 3).map(u => ({
        id: u.user_id,
        name: u.name,
        metric: humanDuration(u.time_solving_sec),
        metricUnit: "solving",
    }));

    return (
        <div className="flex flex-col gap-4">
            {/* Podium — top 3 by productive solving time */}
            <Podium top3={podiumEntries} />

            {/* Full ranked table with Exam + P/C/B/M columns */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-(--border) text-left text-xs text-muted-foreground">
                                <th className="pb-2 pt-3 px-4 font-medium w-10 text-center">#</th>
                                <th className="pb-2 pt-3 px-4 font-medium">Student</th>
                                <th className="pb-2 pt-3 px-4 font-medium">Exam</th>
                                <th className="pb-2 pt-3 px-4 font-medium text-right">Productive solving time</th>
                                <th className="pb-2 pt-3 px-4 font-medium text-right">Solved</th>
                                <th className="pb-2 pt-3 px-4 font-medium text-right" title="Correctly solved per subject: Physics / Chemistry / Biology / Maths">P/C/B/M</th>
                                <th className="pb-2 pt-3 px-4 font-medium text-right">Active days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-(--border)">
                            {leaderboard.slice(0, 50).map((u, i) => (
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
                                            <div className="min-w-0">
                                                <span className="block truncate font-medium text-foreground">{u.name || "Unknown"}</span>
                                                {u.class_name && (
                                                    <span className="block truncate text-[11px] text-muted-foreground">{u.class_name}</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        {u.exams.length === 0 ? (
                                            <span className="text-xs text-muted-foreground/50">—</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {u.exams.map(ex => (
                                                    <span
                                                        key={ex}
                                                        className="inline-flex items-center rounded-full border border-brand-500/20 bg-brand-500/5 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:text-brand-400"
                                                    >
                                                        {formatExamType(ex)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-bold tabular-nums text-foreground">
                                        {humanDuration(u.time_solving_sec)}
                                    </td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                        {u.solved.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <SubjectCounts u={u} />
                                    </td>
                                    <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                        {u.active_days}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
