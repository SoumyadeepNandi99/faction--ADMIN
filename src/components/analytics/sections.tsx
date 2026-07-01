"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
    TrendingUp,
    Swords,
    Flame,
    Star,
    Award,
    Repeat,
    Clock,
    PieChart,
    MapPin,
} from "lucide-react";
import {
    bucketize,
    categoryCounts,
    fetchContestRanking,
    hourDistribution,
    multiCategoryCounts,
    registrationSeries,
    weekdayDistribution,
    istParts,
    type ContestRow,
} from "@/lib/api/analytics";
import { useArena, useClasses, useContests, useRating, useStreak, useUsers } from "./data";
import { matchUser, type Filters } from "./filters";
import { Card, DataTable, EmptyState, RankBadge, Section, Stat, UnavailablePill, type Column } from "./primitives";
import { AreaChart, BarChart, DonutChart, HBarList, Heatmap } from "./charts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatExamType } from "@/lib/exam-types";

function ChartSkeleton({ height = 200 }: { height?: number }) {
    return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

// A small avatar-less name cell shared by ranking tables.
function NameCell({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20 text-xs">
                {name?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="truncate font-medium">{name || "Unknown"}</span>
        </div>
    );
}

// ===========================================================================
// GROWTH — registrations over time (derived from users.created_at, IST days)
// ===========================================================================
export function GrowthSection({ filters }: { filters: Filters }) {
    const { users, loading } = useUsers();
    const students = useMemo(() => users.filter(u => u.role === "STUDENT" && matchUser(u, filters)), [users, filters]);
    const series = useMemo(() => registrationSeries(students), [students]);

    const cumulative = series.map(p => p.cumulative);
    const daily = series.map(p => ({ label: p.date.slice(5), count: p.count }));
    const labels = series.map(p => p.date.slice(5));

    return (
        <Section title="Growth" description="Student registrations over time (IST)" icon={<TrendingUp className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Cumulative Students" subtitle={series.length ? `${series[0].date} → ${series[series.length - 1].date}` : undefined}>
                    {loading ? <ChartSkeleton /> : series.length >= 2 ? <AreaChart points={cumulative} labels={labels} /> : <EmptyState message="Not enough registration history to plot growth." />}
                </Card>
                <Card title="New Registrations / Day">
                    {loading ? (
                        <ChartSkeleton />
                    ) : daily.length >= 2 ? (
                        <BarChart data={daily} labelEvery={Math.max(1, Math.ceil(daily.length / 12))} color="var(--color-accent-blue)" />
                    ) : (
                        <EmptyState message="Not enough registration history." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// PROBLEM SOLVING — arena (all-time) depth & top solvers
// ===========================================================================
export function ProblemSolvingSection({ filters }: { filters: Filters }) {
    const { rows, loading } = useArena(undefined, filters.examType || undefined); // all-time
    const solved = rows.map(r => r.questions_solved);
    const dist = useMemo(
        () =>
            bucketize(solved, [
                { label: "0", min: 0, max: 0 },
                { label: "1–10", min: 1, max: 10 },
                { label: "11–50", min: 11, max: 50 },
                { label: "51–100", min: 51, max: 100 },
                { label: "101–250", min: 101, max: 250 },
                { label: "251–500", min: 251, max: 500 },
                { label: "500+", min: 501 },
            ]),
        [solved],
    );

    const cols: Column<(typeof rows)[number]>[] = [
        { key: "rank", header: "#", render: (_r, i) => <RankBadge rank={i + 1} />, align: "center", className: "w-10" },
        { key: "name", header: "Student", render: r => <NameCell name={r.user_name} /> },
        { key: "solved", header: "Solved", render: r => <span className="font-bold tabular-nums">{r.questions_solved.toLocaleString()}</span>, align: "right" },
    ];

    return (
        <Section title="Problem Solving" description="Arena all-time depth (top 100 solvers)" icon={<Swords className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Solved-Count Distribution" subtitle="How deep the top cohort has gone">
                    {loading ? <ChartSkeleton /> : rows.length ? <HBarList data={dist} /> : <EmptyState message="Arena ranking returned no rows." />}
                </Card>
                <Card title="Top Solvers">
                    {loading ? (
                        <ChartSkeleton />
                    ) : rows.length ? (
                        <DataTable columns={cols} rows={rows} searchable searchKeys={r => r.user_name} searchPlaceholder="Search students…" />
                    ) : (
                        <EmptyState message="Arena ranking returned no rows." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// RATING — distribution across the rated cohort + top rated
// ===========================================================================
export function RatingSection({ filters }: { filters: Filters }) {
    const { rows, loading } = useRating(filters.examType || undefined);
    const dist = useMemo(
        () =>
            bucketize(
                rows.map(r => r.current_rating),
                [
                    { label: "< 800", min: 0, max: 799 },
                    { label: "800–999", min: 800, max: 999 },
                    { label: "1000–1199", min: 1000, max: 1199 },
                    { label: "1200–1399", min: 1200, max: 1399 },
                    { label: "1400–1599", min: 1400, max: 1599 },
                    { label: "1600+", min: 1600 },
                ],
            ),
        [rows],
    );
    const titles = useMemo(() => categoryCounts(rows, r => r.title || "Unrated"), [rows]);

    const cols: Column<(typeof rows)[number]>[] = [
        { key: "rank", header: "#", render: (_r, i) => <RankBadge rank={i + 1} />, align: "center", className: "w-10" },
        { key: "name", header: "Student", render: r => <NameCell name={r.user_name} /> },
        { key: "title", header: "Title", render: r => <span className="text-xs text-muted-foreground">{r.title || "—"}</span> },
        { key: "rating", header: "Rating", render: r => <span className="font-bold tabular-nums">{r.current_rating.toLocaleString()}</span>, align: "right" },
        { key: "peak", header: "Peak", render: r => <span className="text-muted-foreground tabular-nums">{r.max_rating.toLocaleString()}</span>, align: "right" },
    ];

    return (
        <Section title="Rating" description="Competitive rating spread (top 100)" icon={<Star className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Rating Bands">
                    {loading ? <ChartSkeleton /> : rows.length ? <HBarList data={dist} colorByIndex /> : <EmptyState message="Rating ranking returned no rows." />}
                </Card>
                <Card title="Titles">
                    {loading ? <ChartSkeleton /> : titles.length ? <DonutChart data={titles} /> : <EmptyState message="No title data available." />}
                </Card>
                <Card title="Top Rated" className="lg:col-span-2">
                    {loading ? (
                        <ChartSkeleton />
                    ) : rows.length ? (
                        <DataTable columns={cols} rows={rows} searchable searchKeys={r => r.user_name} searchPlaceholder="Search students…" />
                    ) : (
                        <EmptyState message="Rating ranking returned no rows." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// STREAK — consistency across the streak cohort
// ===========================================================================
export function StreakSection({ filters }: { filters: Filters }) {
    const { rows, loading } = useStreak(filters.examType || undefined);
    const dist = useMemo(
        () =>
            bucketize(
                rows.map(r => r.streak_count),
                [
                    { label: "1–2 days", min: 1, max: 2 },
                    { label: "3–6 days", min: 3, max: 6 },
                    { label: "1–2 weeks", min: 7, max: 14 },
                    { label: "2–4 weeks", min: 15, max: 30 },
                    { label: "1–3 months", min: 31, max: 90 },
                    { label: "3 months+", min: 91 },
                ],
            ),
        [rows],
    );
    const cols: Column<(typeof rows)[number]>[] = [
        { key: "rank", header: "#", render: (_r, i) => <RankBadge rank={i + 1} />, align: "center", className: "w-10" },
        { key: "name", header: "Student", render: r => <NameCell name={r.user_name} /> },
        { key: "streak", header: "Streak", render: r => <span className="font-bold tabular-nums">{r.streak_count.toLocaleString()} days</span>, align: "right" },
    ];

    return (
        <Section title="Streaks" description="Daily-habit consistency (top 100)" icon={<Flame className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Streak Distribution">
                    {loading ? <ChartSkeleton /> : rows.length ? <HBarList data={dist} colorByIndex /> : <EmptyState message="Streak ranking returned no rows." />}
                </Card>
                <Card title="Longest Streaks">
                    {loading ? (
                        <ChartSkeleton />
                    ) : rows.length ? (
                        <DataTable columns={cols} rows={rows} searchable searchKeys={r => r.user_name} searchPlaceholder="Search students…" pageSize={8} />
                    ) : (
                        <EmptyState message="Streak ranking returned no rows." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// CONTESTS — schedule cadence + participation (class-scoped)
// ===========================================================================
function contestMonthKey(c: ContestRow): string | null {
    const p = istParts(c.starts_at || c.created_at);
    return p ? p.dateKey.slice(0, 7) : null; // YYYY-MM
}

export function ContestSection() {
    const { contests, loading } = useContests();

    // Classify by the backend-provided status (avoids clock reads in render):
    // "finished" contests are completed; anything else is upcoming/ongoing.
    const past = contests.filter(c => c.status === "finished");
    const upcoming = contests.filter(c => c.status !== "finished");

    const byMonth = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of contests) {
            const k = contestMonthKey(c);
            if (k) m.set(k, (m.get(k) ?? 0) + 1);
        }
        return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ label: label.slice(2), count }));
    }, [contests]);

    // Participation for the most-recent past contest. Backend scopes the ranking
    // to the admin's class, so this legitimately may come back empty.
    const recent = useMemo(
        () => [...past].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0] ?? null,
        [past],
    );
    const { data: ranking, isLoading: rankingLoading } = useSWR(
        recent ? `analytics:contest-ranking:${recent.id}` : null,
        () => fetchContestRanking(recent!.id),
        { revalidateOnFocus: false, dedupingInterval: 300_000 },
    );

    const cols: Column<NonNullable<typeof ranking>["rows"][number]>[] = [
        { key: "rank", header: "#", render: r => <RankBadge rank={r.rank} />, align: "center", className: "w-10" },
        { key: "name", header: "Student", render: r => <NameCell name={r.user_name} /> },
        { key: "acc", header: "Accuracy", render: r => <span className="text-muted-foreground tabular-nums">{Math.round((r.accuracy || 0) * 100)}%</span>, align: "right" },
        { key: "score", header: "Score", render: r => <span className="font-bold tabular-nums">{r.score.toLocaleString()}</span>, align: "right" },
    ];

    return (
        <Section title="Contests" description="Assessment cadence & participation" icon={<Award className="h-5 w-5" />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card><Stat label="Total Contests" value={loading ? "…" : contests.length} /></Card>
                <Card><Stat label="Upcoming" value={loading ? "…" : upcoming.length} /></Card>
                <Card><Stat label="Completed" value={loading ? "…" : past.length} /></Card>
                <Card><Stat label="This Month" value={loading ? "…" : (byMonth.at(-1)?.count ?? 0)} hint="scheduled" /></Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Contests / Month">
                    {loading ? <ChartSkeleton /> : byMonth.length ? <BarChart data={byMonth} color="var(--color-accent-purple)" /> : <EmptyState message="No contests scheduled yet." />}
                </Card>
                <Card
                    title="Latest Contest Participation"
                    subtitle={recent ? recent.name : undefined}
                    right={ranking && ranking.total ? <span className="text-xs text-muted-foreground">{ranking.total} participants</span> : undefined}
                >
                    {loading || rankingLoading ? (
                        <ChartSkeleton />
                    ) : !recent ? (
                        <EmptyState message="No completed contests to report on." />
                    ) : ranking && ranking.rows.length ? (
                        <DataTable columns={cols} rows={ranking.rows} pageSize={8} />
                    ) : (
                        <UnavailablePill reason="Contest ranking is scoped to the admin's own class by the backend, so cross-class participation isn't derivable here." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// DEMOGRAPHICS — class / exam / batch / geography split of the student base
// ===========================================================================
export function DemographicsSection({ filters }: { filters: Filters }) {
    const { users, loading } = useUsers();
    const { classes } = useClasses();
    const classNames = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

    const students = useMemo(() => users.filter(u => u.role === "STUDENT" && matchUser(u, filters)), [users, filters]);

    const byExam = useMemo(() => multiCategoryCounts(students, u => u.target_exams).map(b => ({ label: formatExamType(b.label), count: b.count })), [students]);
    const byClass = useMemo(() => categoryCounts(students, u => (u.class_id ? classNames.get(u.class_id) ?? u.class_id : null), "No class"), [students, classNames]);
    const byBatch = useMemo(() => categoryCounts(students, u => u.batch, "No batch"), [students]);
    const byState = useMemo(() => categoryCounts(students, u => u.state, "Unknown").slice(0, 10), [students]);

    return (
        <Section title="Demographics" description="Who makes up the student base" icon={<PieChart className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Target Exam">
                    {loading ? <ChartSkeleton /> : byExam.length ? <DonutChart data={byExam} /> : <EmptyState message="No exam data on student profiles." />}
                </Card>
                <Card title="Class">
                    {loading ? <ChartSkeleton /> : byClass.length ? <DonutChart data={byClass} /> : <EmptyState message="No class data on student profiles." />}
                </Card>
                <Card title="Batch">
                    {loading ? <ChartSkeleton /> : byBatch.length ? <HBarList data={byBatch.slice(0, 10)} colorByIndex /> : <EmptyState message="No batch data on student profiles." />}
                </Card>
                <Card title="Top States" subtitle="By registered students">
                    {loading ? <ChartSkeleton /> : byState.some(b => b.label !== "Unknown") ? <HBarList data={byState} /> : <UnavailablePill reason="Student profiles carry no location data to derive geography from." />}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// REGISTRATION ACTIVITY — when students sign up (weekday × hour heatmap, IST)
// ===========================================================================
export function ActivitySection({ filters }: { filters: Filters }) {
    const { users, loading } = useUsers();
    const students = useMemo(() => users.filter(u => u.role === "STUDENT" && matchUser(u, filters)), [users, filters]);

    const hours = useMemo(() => hourDistribution(students).map((count, h) => ({ label: `${h}`, count })), [students]);
    const weekdays = useMemo(() => weekdayDistribution(students), [students]);

    // weekday(row) × hour(col) grid
    const heat = useMemo(() => {
        const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
        for (const u of students) {
            const p = istParts(u.created_at);
            if (p) g[p.weekdayIndex][p.hour] += 1;
        }
        return g;
    }, [students]);
    const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <Section title="Registration Activity" description="When students join, in IST" icon={<Clock className="h-5 w-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="By Hour of Day">
                    {loading ? <ChartSkeleton /> : students.length ? <BarChart data={hours} labelEvery={3} /> : <EmptyState message="No registration data." />}
                </Card>
                <Card title="By Weekday">
                    {loading ? <ChartSkeleton /> : students.length ? <BarChart data={weekdays} color="var(--color-accent-blue)" /> : <EmptyState message="No registration data." />}
                </Card>
                <Card title="Weekday × Hour Heatmap" className="lg:col-span-2" subtitle="Registration density (IST)">
                    {loading ? <ChartSkeleton /> : students.length ? <Heatmap grid={heat} rows={WD} cols={Array.from({ length: 24 }, (_, h) => `${h}`)} /> : <EmptyState message="No registration data." />}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// RETENTION — genuinely NOT derivable from the available endpoints
// ===========================================================================
export function RetentionSection() {
    const items = [
        { label: "Monthly Active Users (MAU)", reason: "Arena ranking exposes only daily & weekly windows — there is no monthly activity feed to derive a 30-day active count from." },
        { label: "D1 / D7 / D30 Retention", reason: "No per-user event timeline is exposed; cohort return-rates can't be reconstructed from ranking snapshots." },
        { label: "Avg. Session Duration", reason: "No session/heartbeat endpoint exists in the current API surface." },
        { label: "Churn Rate", reason: "Requires longitudinal activity per user, which no available endpoint provides." },
    ];
    return (
        <Section title="Retention & Engagement" description="Requires event data the API doesn't expose" icon={<Repeat className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map(it => (
                    <Card key={it.label} title={it.label}>
                        <UnavailablePill reason={it.reason} />
                    </Card>
                ))}
            </div>
        </Section>
    );
}

// A tiny inline note component reused where a caveat matters.
export function DerivationNote({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs text-muted-foreground/80 flex items-start gap-1.5">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            {children}
        </p>
    );
}
