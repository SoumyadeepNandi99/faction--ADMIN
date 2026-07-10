"use client";

/**
 * Event detail — participant leaderboard (World Cup / Faction Legends).
 *
 * Ranks the students taking part in the event by the number of questions they
 * have solved so far. That count is the same one the app's Faction Legends
 * "Progress" surfaces (subject-scoped solves from study-stats); here we read it
 * read-only via /api/events/:id/leaderboard. Nothing in the app or backend is
 * changed — this only reports on existing student progress.
 */

import { useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import {
    ArrowLeft, Trophy, ChevronDown, ChevronUp, RefreshCw, Users, Target, CheckCircle2, Flame, CalendarDays,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Podium, type PodiumEntry } from "@/components/leaderboard/podium";
import { useEventLeaderboard } from "@/components/events/data";
import type { EventLeaderRow } from "@/lib/events/queries";
import { getEvent, eventStatus, type EventStatus } from "@/lib/events/config";
import { formatDate } from "@/lib/datetime";

const MEDALS = ["🥇", "🥈", "🥉"];
const STATUS_LABEL: Record<EventStatus, string> = { ongoing: "Ongoing", upcoming: "Upcoming", ended: "Ended" };
const STATUS_BADGE: Record<EventStatus, string> = {
    ongoing: "bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20",
    upcoming: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20",
    ended: "bg-foreground/10 text-muted-foreground",
};

type SortKey = "questions_solved" | "accuracy_rate" | "current_streak" | "total_attempts";

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="glass-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">{icon}</div>
            <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
            </div>
        </div>
    );
}

function RowAvatar({ name, url }: { name: string | null; url: string | null }) {
    if (url) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name || "avatar"} className="h-7 w-7 rounded-full object-cover border border-brand-500/20" />
        );
    }
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-500/20 bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-400">
            {name?.[0]?.toUpperCase() || "?"}
        </div>
    );
}

/** Per-subject solved chip row (only shows subjects with a non-zero count). */
function SubjectChips({ u }: { u: EventLeaderRow }) {
    const cells = [
        { k: "P", label: "Physics", v: u.solved_physics },
        { k: "C", label: "Chemistry", v: u.solved_chemistry },
        { k: "B", label: "Biology", v: u.solved_biology },
        { k: "M", label: "Maths", v: u.solved_maths },
    ].filter(c => c.v > 0);
    if (cells.length === 0) return <span className="text-xs text-muted-foreground/50">—</span>;
    return (
        <div className="flex items-center justify-end gap-1.5 tabular-nums">
            {cells.map(c => (
                <span
                    key={c.k}
                    title={c.label}
                    className="inline-flex items-center gap-0.5 rounded-md bg-brand-500/10 px-1.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400"
                >
                    <span className="font-bold">{c.k}</span>
                    {c.v}
                </span>
            ))}
        </div>
    );
}

function SortHeader({ label, col, sort, onSort }: {
    label: string; col: SortKey;
    sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void;
}) {
    const active = sort.key === col;
    return (
        <th className="pb-2 pt-3 px-4 font-medium text-right">
            <button
                onClick={() => onSort(col)}
                className={`inline-flex items-center gap-1 ml-auto transition-colors cursor-pointer ${active ? "text-foreground" : "hover:text-foreground"}`}
            >
                {label}
                {active ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-20" />}
            </button>
        </th>
    );
}

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.eventId as string;
    const event = getEvent(eventId);

    const { data, error, loading, mutate } = useEventLeaderboard(eventId);
    const board = useMemo(() => data?.leaderboard ?? [], [data]);

    const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "questions_solved", dir: "desc" });
    const onSort = (key: SortKey) =>
        setSort(s => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

    // Config-missing is a 404; hooks above already ran so this is safe.
    if (!event) return notFound();
    const status = eventStatus(event);

    // Podium always reflects the top 3 by questions solved (not the table sort).
    const podium: PodiumEntry[] = [...board]
        .sort((a, b) => b.questions_solved - a.questions_solved)
        .slice(0, 3)
        .map(u => ({ id: u.user_id, name: u.name, avatar_url: u.avatar_url, metric: u.questions_solved.toLocaleString(), metricUnit: "solved" }));

    const sorted = [...board].sort((a, b) => {
        const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0;
        return sort.dir === "desc" ? bv - av : av - bv;
    });

    const totalSolved = board.reduce((s, u) => s + u.questions_solved, 0);
    const topSolved = board.length ? Math.max(...board.map(u => u.questions_solved)) : 0;

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => router.push("/events")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit transition-colors cursor-pointer"
                >
                    <ArrowLeft className="h-4 w-4" /> All events
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-foreground/5 rounded-xl border border-(--card-border) text-3xl leading-none">{event.emoji}</div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">{event.name}</h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${STATUS_BADGE[status]}`}>
                                    {status === "ongoing" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                    {STATUS_LABEL[status]}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(event.startDateISO)} – {formatDate(event.endDateISO)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => mutate()}
                        className="flex items-center gap-2 self-start px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                </div>
                <p className="text-muted-foreground max-w-3xl">{event.description}</p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={<Users className="h-5 w-5" />} label="Participants" value={board.length.toLocaleString()} />
                <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Total solved" value={totalSolved.toLocaleString()} />
                <StatCard icon={<Target className="h-5 w-5" />} label="Top solver" value={topSolved.toLocaleString()} />
            </div>

            {/* Loading / error / empty / data */}
            {loading ? (
                <div className="glass-card p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <div className="flex-1"><Skeleton className="h-4 w-40 rounded" /></div>
                            <Skeleton className="h-4 w-16 rounded" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="glass-card p-12 text-center flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 text-destructive/50" />
                    <h3 className="text-lg font-bold text-foreground">Failed to Load Leaderboard</h3>
                    <p className="text-muted-foreground text-sm">Could not fetch participant progress from the database.</p>
                    <button onClick={() => mutate()} className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                        Retry
                    </button>
                </div>
            ) : board.length === 0 ? (
                <div className="glass-card p-12 text-center flex flex-col items-center">
                    <Trophy className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-bold text-foreground">No Participants Yet</h3>
                    <p className="text-muted-foreground mt-1 text-sm">No students have solved questions in this event yet.</p>
                </div>
            ) : (
                <>
                    {/* Podium — top 3 by questions solved */}
                    <Podium top3={podium} title="Leading the World Cup" subtitle="By questions solved" unit="solved" showTrophy />

                    <p className="text-xs text-muted-foreground px-1">
                        {board.length.toLocaleString()} student{board.length === 1 ? "" : "s"} participating
                    </p>

                    {/* Full ranked table */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-(--border) text-left text-xs text-muted-foreground">
                                        <th className="pb-2 pt-3 px-4 font-medium w-10 text-center">#</th>
                                        <th className="pb-2 pt-3 px-4 font-medium">Student</th>
                                        <th className="pb-2 pt-3 px-4 font-medium">Class</th>
                                        <SortHeader label="Solved" col="questions_solved" sort={sort} onSort={onSort} />
                                        <th className="pb-2 pt-3 px-4 font-medium text-right" title="Solved per subject">By subject</th>
                                        <SortHeader label="Accuracy" col="accuracy_rate" sort={sort} onSort={onSort} />
                                        <SortHeader label="Streak" col="current_streak" sort={sort} onSort={onSort} />
                                        <th className="pb-2 pt-3 px-4 font-medium text-right">Last active</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-(--border)">
                                    {sorted.map((u, i) => (
                                        <tr key={u.user_id} className="hover:bg-foreground/[0.03]">
                                            <td className="py-2.5 px-4 text-center">
                                                {i < 3 && sort.key === "questions_solved" && sort.dir === "desc" ? (
                                                    <span className="text-base leading-none">{MEDALS[i]}</span>
                                                ) : (
                                                    <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <RowAvatar name={u.name} url={u.avatar_url} />
                                                    <div className="min-w-0">
                                                        <span className="block truncate font-medium text-foreground">{u.name || "Unknown"}</span>
                                                        {u.username && <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>}
                                                    </div>
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
                                                {u.questions_solved.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-4"><SubjectChips u={u} /></td>
                                            <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                                                {u.accuracy_rate != null ? `${u.accuracy_rate.toFixed(1)}%` : "—"}
                                            </td>
                                            <td className="py-2.5 px-4 text-right tabular-nums">
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    {u.current_streak > 0 && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                                                    {u.current_streak}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-xs text-muted-foreground">
                                                {u.last_active ? formatDate(u.last_active) : "—"}
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
