"use client";

import { useEffect, useMemo } from "react";
import { Users, UserPlus, Swords, CheckCircle2, Star, Flame, Trophy, Activity } from "lucide-react";
import {
    mean,
    median,
    registrationSeries,
    saveSnapshot,
    snapshotDelta,
    snapshotSeries,
} from "@/lib/api/analytics";
import { useArena, useRating, useStreak, useTopPerformers, useUsers } from "./data";
import { matchUser, type Filters } from "./filters";
import { KpiCard, Card, Stat, Section } from "./primitives";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
    return (
        <div className="glass-card p-5 flex flex-col gap-3">
            <div className="flex justify-between">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
        </div>
    );
}

export function Overview({ filters }: { filters: Filters }) {
    const { users, loading: usersLoading } = useUsers();
    // Daily arena window drives "today"'s activity; all-time drives depth metrics.
    const { rows: arenaDaily, loading: arenaDailyLoading } = useArena("daily", filters.examType || undefined);
    const { rows: rating, loading: ratingLoading } = useRating(filters.examType || undefined);
    const { rows: streak } = useStreak(filters.examType || undefined);
    const { top } = useTopPerformers();

    const filteredUsers = useMemo(() => users.filter(u => matchUser(u, filters)), [users, filters]);
    const students = useMemo(() => filteredUsers.filter(u => u.role === "STUDENT"), [filteredUsers]);

    // registrations in the trailing 7 days (of the filtered set)
    const new7d = useMemo(() => {
        const series = registrationSeries(students);
        return series.slice(-7).reduce((a, b) => a + b.count, 0);
    }, [students]);

    const totalStudents = students.length;
    const activeSolversToday = arenaDaily.length; // top-100 window; may under-count beyond 100
    const questionsToday = arenaDaily.reduce((a, r) => a + (r.questions_solved || 0), 0);
    const avgRating = rating.length ? Math.round(mean(rating.map(r => r.current_rating))) : 0;
    const longestStreak = streak.length ? Math.max(...streak.map(s => s.streak_count)) : 0;

    // Persist a daily snapshot so day-over-day deltas + sparklines are REAL.
    // Only snapshot the unfiltered totals (filters change per-view; snapshots are global).
    const globalStudents = users.filter(u => u.role === "STUDENT").length;
    useEffect(() => {
        if (usersLoading) return;
        saveSnapshot({
            totalStudents: globalStudents,
            activeSolversToday,
            questionsToday,
            avgRating,
        });
    }, [usersLoading, globalStudents, activeSolversToday, questionsToday, avgRating]);

    const filtersActive = filters.examType || filters.classId || filters.batch || filters.from || filters.to;

    if (usersLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <KpiSkeleton key={i} />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    label="Total Students"
                    value={totalStudents}
                    icon={<Users className="h-5 w-5" />}
                    sub={filtersActive ? "matching filters" : "registered"}
                    delta={filtersActive ? undefined : snapshotDelta("totalStudents", globalStudents)}
                    spark={filtersActive ? undefined : snapshotSeries("totalStudents")}
                />
                <KpiCard
                    label="New (7 days)"
                    value={new7d}
                    icon={<UserPlus className="h-5 w-5" />}
                    accent="blue"
                    sub="recent sign-ups"
                />
                <KpiCard
                    label="Active Solvers (Today)"
                    value={activeSolversToday}
                    icon={<Swords className="h-5 w-5" />}
                    accent="purple"
                    sub={activeSolversToday >= 100 ? "top 100 (capped)" : "solved ≥1 today"}
                    delta={filtersActive ? undefined : snapshotDelta("activeSolversToday", activeSolversToday)}
                    spark={filtersActive ? undefined : snapshotSeries("activeSolversToday")}
                    unavailable={!arenaDailyLoading && arenaDaily.length === 0}
                    unavailableReason="No arena activity recorded for today yet."
                />
                <KpiCard
                    label="Questions Solved (Today)"
                    value={questionsToday}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    accent="pink"
                    sub={activeSolversToday >= 100 ? "among top 100 solvers" : "across all solvers"}
                    delta={filtersActive ? undefined : snapshotDelta("questionsToday", questionsToday)}
                    spark={filtersActive ? undefined : snapshotSeries("questionsToday")}
                    unavailable={!arenaDailyLoading && arenaDaily.length === 0}
                    unavailableReason="Derived from today's arena ranking, which is empty."
                />
                <KpiCard
                    label="Avg Rating (Top 100)"
                    value={avgRating}
                    icon={<Star className="h-5 w-5" />}
                    sub={rating.length ? `across ${rating.length} rated` : undefined}
                    delta={filtersActive ? undefined : snapshotDelta("avgRating", avgRating)}
                    spark={filtersActive ? undefined : snapshotSeries("avgRating")}
                    unavailable={!ratingLoading && rating.length === 0}
                    unavailableReason="Rating ranking returned no rows."
                />
                <KpiCard
                    label="Longest Active Streak"
                    value={longestStreak}
                    icon={<Flame className="h-5 w-5" />}
                    accent="pink"
                    sub={longestStreak ? "days (current cohort)" : undefined}
                    unavailable={streak.length === 0}
                    unavailableReason="Streak ranking returned no rows."
                />
            </div>

            <ArenaHealth
                top={top}
                ratingValues={rating.map(r => r.current_rating)}
                solvedValues={arenaDaily.map(r => r.questions_solved)}
            />
        </div>
    );
}

function ArenaHealth({
    top,
    ratingValues,
    solvedValues,
}: {
    top: import("@/lib/api/analytics").TopPerformers | null;
    ratingValues: number[];
    solvedValues: number[];
}) {
    const name = (u: { name?: string; user_name?: string } | null | undefined) => u?.name || u?.user_name || "—";
    return (
        <Section title="Arena Health" description="Snapshot of competitive engagement" icon={<Activity className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Top Performers">
                    <div className="flex flex-col gap-3">
                        <TopPerformerRow icon={<Star className="h-4 w-4 text-accent-purple" />} label="Best Rating" name={name(top?.best_rating?.user)} value={top?.best_rating?.metric_value} suffix="rating" />
                        <TopPerformerRow icon={<Trophy className="h-4 w-4 text-brand-500" />} label="Most Solved" name={name(top?.best_questions?.user)} value={top?.best_questions?.metric_value} suffix="solved" />
                        <TopPerformerRow icon={<Activity className="h-4 w-4 text-accent-pink" />} label="Biggest Delta" name={name(top?.best_delta?.user)} value={top?.best_delta?.metric_value} suffix="Δ" />
                    </div>
                </Card>
                <Card title="Rating Distribution" subtitle="Top 100 rated students">
                    <div className="grid grid-cols-2 gap-4">
                        <Stat label="Mean" value={ratingValues.length ? Math.round(mean(ratingValues)) : "—"} />
                        <Stat label="Median" value={ratingValues.length ? Math.round(median(ratingValues)) : "—"} />
                        <Stat label="Highest" value={ratingValues.length ? Math.max(...ratingValues) : "—"} />
                        <Stat label="Lowest" value={ratingValues.length ? Math.min(...ratingValues) : "—"} />
                    </div>
                </Card>
                <Card title="Today's Solving" subtitle="Among ranked solvers today">
                    <div className="grid grid-cols-2 gap-4">
                        <Stat label="Solvers" value={solvedValues.length || "—"} />
                        <Stat label="Total Solved" value={solvedValues.length ? solvedValues.reduce((a, b) => a + b, 0) : "—"} />
                        <Stat label="Median / solver" value={solvedValues.length ? Math.round(median(solvedValues)) : "—"} />
                        <Stat label="Top solver" value={solvedValues.length ? Math.max(...solvedValues) : "—"} />
                    </div>
                </Card>
            </div>
        </Section>
    );
}

function TopPerformerRow({ icon, label, name, value, suffix }: { icon: React.ReactNode; label: string; name: string; value?: number; suffix: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-foreground/5 border border-(--card-border)">{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">
                {value !== undefined ? `${value.toLocaleString()} ${suffix}` : "—"}
            </span>
        </div>
    );
}
