"use client";

/**
 * Most Active Users — moved here from the Founder Analytics module.
 *
 * Renders a faction-web-style podium for the top 3 solvers followed by the
 * exact same ranked table that previously lived in the analytics
 * `MostActiveUsersSection`. Data comes from the same `useActiveUsers` hook
 * (the local `/api/analytics/active-users` route); it is independent of the
 * axios-based ranking tabs on this page, so it always shows the platform-wide
 * "last 10 days" window (no analytics filter bar exists on this page).
 */

import { Crown, Medal, Award, Timer } from "lucide-react";
import { useActiveUsers } from "@/components/analytics/data";
import { EMPTY_FILTERS } from "@/lib/api/analytics";
import { humanDuration } from "@/components/analytics/format";
import { Skeleton } from "@/components/ui/skeleton";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Per-place styling for the podium (1st = gold, 2nd = silver, 3rd = bronze). */
const PLACE = {
    1: { color: "#FFD54A", glow: "rgba(255,213,74,0.55)", height: "h-28", icon: Crown, avatar: 92 },
    2: { color: "#CBD5E1", glow: "rgba(203,213,225,0.40)", height: "h-20", icon: Medal, avatar: 72 },
    3: { color: "#E8996B", glow: "rgba(232,153,107,0.40)", height: "h-16", icon: Award, avatar: 72 },
} as const;

type LeaderRow = {
    user_id: string;
    name: string | null;
    time_solving_sec: number;
    solved: number;
    attempts: number;
    active_days: number;
};

/** Initials-circle avatar (no photo URLs are returned by this endpoint). */
function Initial({ name, size, ring }: { name: string | null; size: number; ring?: string }) {
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-bold text-brand-600 dark:text-brand-400"
            style={{
                height: size,
                width: size,
                fontSize: Math.round(size * 0.4),
                border: ring ? `3px solid ${ring}` : "1px solid color-mix(in srgb, var(--color-brand-500) 20%, transparent)",
            }}
        >
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

function Podium({ top3 }: { top3: LeaderRow[] }) {
    // Render order [2nd, 1st, 3rd] so 1st sits centered and tallest.
    const order: Array<{ e: LeaderRow; place: 1 | 2 | 3 } | null> = [
        top3[1] ? { e: top3[1], place: 2 } : null,
        top3[0] ? { e: top3[0], place: 1 } : null,
        top3[2] ? { e: top3[2], place: 3 } : null,
    ];

    return (
        <div className="fx-podium-stage relative overflow-hidden rounded-3xl px-4 pt-8 pb-0 sm:px-8">
            {/* Ambient glow + scanline grid */}
            <div className="fx-podium-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
            <div
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent 70%)" }}
            />

            {/* Section label */}
            <div className="relative mb-6 flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-linear-to-r from-transparent to-white/40" />
                <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">Top Ranked</span>
                <span className="h-px w-8 bg-linear-to-l from-transparent to-white/40" />
            </div>

            {/* Pedestals */}
            <div className="relative flex items-end justify-center gap-1.5 sm:gap-2">
                {order.map((slot, i) => {
                    if (!slot) return <div key={i} className="w-24 sm:w-28" />;
                    const { e, place } = slot;
                    const meta = PLACE[place];
                    const Icon = meta.icon;
                    return (
                        <div key={e.user_id} className="group flex w-24 flex-col items-center sm:w-28">
                            {/* Crown / medal above the champion */}
                            <Icon
                                className={`mb-1.5 drop-shadow ${place === 1 ? "size-7" : "size-5"}`}
                                style={{ color: meta.color, filter: `drop-shadow(0 0 8px ${meta.glow})` }}
                                fill={place === 1 ? meta.color : "none"}
                            />

                            {/* Avatar with neon halo */}
                            <div className="relative">
                                <span
                                    className="absolute -inset-1.5 rounded-full opacity-70 blur-md transition-opacity group-hover:opacity-100"
                                    style={{ background: meta.glow }}
                                />
                                <span
                                    className="relative block rounded-full"
                                    style={{ boxShadow: `0 0 0 3px ${meta.color}, 0 0 22px ${meta.glow}` }}
                                >
                                    <Initial name={e.name} size={meta.avatar} ring={meta.color} />
                                </span>
                            </div>

                            {/* Name + metric */}
                            <span className="mt-2.5 max-w-full truncate px-1 text-[13px] font-bold text-white">
                                {e.name || "Unknown"}
                            </span>
                            <span className="text-xs font-extrabold tabular-nums" style={{ color: meta.color }}>
                                {humanDuration(e.time_solving_sec)}
                                <span className="ml-0.5 font-semibold text-white/50">on task</span>
                            </span>

                            {/* The pedestal block */}
                            <div
                                className={`fx-pedestal relative mt-3 flex w-full items-start justify-center rounded-t-xl pt-2.5 ${meta.height}`}
                                style={{ ["--p-color" as string]: meta.color, ["--p-glow" as string]: meta.glow }}
                            >
                                <span
                                    className="font-display text-3xl font-black leading-none"
                                    style={{ color: meta.color, textShadow: `0 0 18px ${meta.glow}` }}
                                >
                                    {place}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function MostActiveUsers() {
    const { data, error, loading } = useActiveUsers(EMPTY_FILTERS);
    const leaderboard = (data?.leaderboard ?? []) as LeaderRow[];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Timer className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">Most Active Users</h2>
                    <p className="text-xs text-muted-foreground">
                        Ranked by practice arena time — measured time on task, not full app screentime (last 10 days, IST).
                    </p>
                </div>
            </div>

            {loading ? (
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
            ) : error ? (
                <div className="glass-card p-12 text-center text-muted-foreground">
                    Could not load activity data.
                </div>
            ) : leaderboard.length === 0 ? (
                <div className="glass-card p-12 text-center text-muted-foreground">
                    No solving activity in this window.
                </div>
            ) : (
                <>
                    {/* Podium — top 3 solvers */}
                    <Podium top3={leaderboard.slice(0, 3)} />

                    {/* Full ranked list (same table as the old analytics section) */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-(--border) text-left text-xs text-muted-foreground">
                                        <th className="pb-2 pt-3 px-4 font-medium w-10 text-center">#</th>
                                        <th className="pb-2 pt-3 px-4 font-medium">Student</th>
                                        <th className="pb-2 pt-3 px-4 font-medium text-right">Practice arena time</th>
                                        <th className="pb-2 pt-3 px-4 font-medium text-right">Solved</th>
                                        <th className="pb-2 pt-3 px-4 font-medium text-right">Active days</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-(--border)">
                                    {leaderboard.slice(0, 20).map((u, i) => (
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
                                                    <Initial name={u.name} size={28} />
                                                    <span className="truncate font-medium text-foreground">{u.name || "Unknown"}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-bold tabular-nums text-foreground">
                                                {humanDuration(u.time_solving_sec)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                                {u.solved.toLocaleString()}
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
                </>
            )}
        </div>
    );
}
