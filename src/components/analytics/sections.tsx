"use client";

/**
 * The six Founder Analytics sections, each backed by a read-only SQL endpoint.
 * Every card guards its own state independently:
 *   loading → skeleton, error → ErrorState, no rows → EmptyState / "—".
 * One failing query never blanks the page.
 */

import { useMemo, useState } from "react";
import {
    Activity,
    AlertTriangle,
    BookOpenCheck,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    Flame,
    Globe,
    GraduationCap,
    Clock,
    Gauge,
    Hourglass,
    Layers,
    MessageSquare,
    Repeat,
    Rocket,
    Smartphone,
    Star,
    Swords,
    TrendingUp,
    Trophy,
    UserPlus,
    Users,
    Zap,
} from "lucide-react";
import { AreaChart, BarChart, DonutChart, HBarList, ProgressBar } from "./charts";
import {
    Card,
    EmptyState,
    ErrorState,
    InfoTip,
    KpiCard,
    Section,
    Stat,
    UnavailablePill,
} from "./primitives";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useActivation,
    useEngagement,
    useFeatures,
    useMonetization,
    useOutcomes,
    useStreaks,
    useTimeSpent,
} from "./data";
import { AnalyticsFetchError, type Filters } from "@/lib/api/analytics";
import { formatDate } from "@/lib/datetime";
import { humanHours, kpi, n, pct } from "./format";
import { EXPLAIN } from "./explain";

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------
function errParts(error: unknown): { code?: string; detail?: string } {
    if (error instanceof AnalyticsFetchError) return { code: error.code, detail: error.detail };
    if (error instanceof Error) return { detail: error.message };
    return {};
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
    return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}

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

/** Render a strip of KPI cards, or a single error/skeleton spanning the grid. */
function KpiStrip({
    loading,
    error,
    count,
    children,
}: {
    loading: boolean;
    error: unknown;
    count: number;
    children: React.ReactNode;
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: count }).map((_, i) => (
                    <KpiSkeleton key={i} />
                ))}
            </div>
        );
    }
    if (error) {
        const { code, detail } = errParts(error);
        return (
            <div className="glass-card p-6">
                <ErrorState code={code} detail={detail} />
            </div>
        );
    }
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{children}</div>;
}

// ===========================================================================
// 1. NORTH STAR & ENGAGEMENT
// ===========================================================================
export function EngagementSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useEngagement(filters);
    const s = data?.summary;

    const solversSeries = useMemo(() => data?.solvers.map(p => p.value) ?? [], [data]);
    const solversLabels = useMemo(() => data?.solvers.map(p => p.day.slice(5)) ?? [], [data]);
    const signupsBars = useMemo(() => data?.signups.map(p => ({ label: p.day.slice(5), count: p.value })) ?? [], [data]);
    const signupsLabels = useMemo(() => data?.signups.map(p => p.day.slice(5)) ?? [], [data]);
    // Running total of new signups per day, for the cumulative (growth) line.
    // Each point is the sum of all values up to and including its index (pure,
    // no render-scope accumulator to reassign).
    const signupsCumulative = useMemo(() => {
        const vals = (data?.signups ?? []).map(p => p.value);
        return vals.map((_, i) => vals.slice(0, i + 1).reduce((a, b) => a + b, 0));
    }, [data]);
    const dauSpark = useMemo(() => solversSeries.slice(-14), [solversSeries]);
    // New Signups card view: cumulative growth line vs per-day bars.
    const [signupsMode, setSignupsMode] = useState<"cumulative" | "daily">("daily");

    return (
        <Section
            title="North Star & Engagement"
            description="Daily active solvers and the habit ratio that explains it"
            icon={<Activity className="h-5 w-5" />}
        >
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard
                    label="Daily Active Solvers"
                    value={kpi(s?.dau)}
                    icon={<Zap className="h-5 w-5" />}
                    sub="distinct solvers today (IST)"
                    spark={dauSpark.length >= 2 ? dauSpark : undefined}
                    info={EXPLAIN.dau}
                />
                <KpiCard
                    label="Weekly Active Solvers"
                    value={kpi(s?.wau)}
                    accent="blue"
                    icon={<Users className="h-5 w-5" />}
                    sub="last 7 days"
                    info={EXPLAIN.wau}
                />
                <KpiCard
                    label="Monthly Active Solvers"
                    value={kpi(s?.mau)}
                    accent="purple"
                    icon={<Users className="h-5 w-5" />}
                    sub="last 30 days"
                    info={EXPLAIN.mau}
                />
                <KpiCard
                    label="Stickiness (DAU/MAU)"
                    value={pct(s?.stickiness_pct)}
                    accent="pink"
                    icon={<Repeat className="h-5 w-5" />}
                    sub={s && s.stickiness_pct != null && s.stickiness_pct >= 20 ? "healthy (≥20%)" : "target ≥20%"}
                    info={EXPLAIN.stickiness}
                />
                <KpiCard
                    label="Questions / Active User / Day"
                    value={kpi(s?.questions_per_active_user)}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    sub="avg on active days"
                    info={EXPLAIN.qpau}
                />
                <KpiCard
                    label="Total Students"
                    value={kpi(s?.total_students)}
                    icon={<Users className="h-5 w-5" />}
                    sub="matching filters"
                    info={EXPLAIN.totalStudents}
                />
                <KpiCard
                    label="New Signups"
                    value={kpi(s?.new_signups)}
                    accent="blue"
                    icon={<UserPlus className="h-5 w-5" />}
                    sub="in selected range"
                    info={EXPLAIN.newSignups}
                />
                <KpiCard
                    label="Growth vs Prev Period"
                    value={pct(s?.growth_pct)}
                    accent={s && s.growth_pct != null && s.growth_pct < 0 ? "pink" : "brand"}
                    icon={<TrendingUp className="h-5 w-5" />}
                    sub={`${n(s?.prev_signups)} previous`}
                    info={EXPLAIN.growth}
                />
            </KpiStrip>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Daily Active Solvers" subtitle="Distinct users with ≥1 attempt (IST day)" info={EXPLAIN.dauChart}>
                    {loading ? (
                        <ChartSkeleton />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : solversSeries.length >= 2 ? (
                        <AreaChart points={solversSeries} labels={solversLabels} valueLabel="active solvers" />
                    ) : (
                        <EmptyState message="Not enough activity history to plot a trend yet." />
                    )}
                </Card>
                <Card
                    title="New Signups"
                    info={EXPLAIN.signupsChart}
                    subtitle={signupsMode === "cumulative" ? "Cumulative students (growth)" : "New signups per day (IST)"}
                    right={
                        <div className="inline-flex rounded-lg border border-(--card-border) bg-foreground/5 p-0.5 text-xs">
                            {(["cumulative", "daily"] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSignupsMode(m)}
                                    className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                                        signupsMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    }
                >
                    {loading ? (
                        <ChartSkeleton />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : signupsBars.length >= 2 ? (
                        signupsMode === "cumulative" ? (
                            <AreaChart points={signupsCumulative} labels={signupsLabels} valueLabel="total students" />
                        ) : (
                            <BarChart data={signupsBars} color="var(--color-accent-blue)" labelEvery={Math.max(1, Math.ceil(signupsBars.length / 12))} />
                        )
                    ) : (
                        <EmptyState message="Not enough signup history to plot." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// 2. ACTIVATION & RETENTION
// ===========================================================================
export function ActivationSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useActivation(filters);
    const s = data?.summary;
    const cohorts = data?.cohorts ?? [];

    return (
        <Section
            title="Activation & Retention"
            description="Do new users reach the first solve, and do they come back?"
            icon={<Rocket className="h-5 w-5" />}
        >
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard label="Activation Rate (48h)" value={pct(s?.activation_pct)} icon={<Rocket className="h-5 w-5" />} sub="solve ≥1 Q within 48h of signup" info={EXPLAIN.activation48h} />
                <KpiCard label="Activated Users" value={kpi(s?.activated_48h)} accent="blue" icon={<CheckCircle2 className="h-5 w-5" />} sub={`of ${n(s?.signups)} signups`} info={EXPLAIN.activatedUsers} />
                <KpiCard label="Median Time to First Solve" value={humanHours(s?.median_hours_to_first_solve)} accent="purple" icon={<Zap className="h-5 w-5" />} sub="signup to first attempt" info={EXPLAIN.timeToFirstSolve} />
                <KpiCard label="Signups (range)" value={kpi(s?.signups)} icon={<UserPlus className="h-5 w-5" />} sub="cohort size" info={EXPLAIN.signupsCohort} />
            </KpiStrip>

            <Card title="Retention by Weekly Signup Cohort" subtitle="% of each week's new users active again on day 1 / 7 / 30 (IST)" info={EXPLAIN.retentionCohorts}>
                {loading ? (
                    <ChartSkeleton height={180} />
                ) : error ? (
                    <ErrorState {...errParts(error)} />
                ) : cohorts.length === 0 ? (
                    <EmptyState message="No signup cohorts in range." />
                ) : (
                    <CohortTable cohorts={cohorts} />
                )}
            </Card>
        </Section>
    );
}

function CohortTable({ cohorts }: { cohorts: NonNullable<ReturnType<typeof useActivation>["data"]>["cohorts"] }) {
    const cell = (val: number, pctVal: number | null, elapsed: boolean) => {
        if (!elapsed) return <span className="text-muted-foreground/50 text-xs">pending</span>;
        const p = pctVal ?? 0;
        const bg = `color-mix(in srgb, var(--color-brand-500) ${Math.round(12 + Math.min(p, 100) * 0.7)}%, transparent)`;
        return (
            <span className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums" style={{ background: bg }}>
                {pctVal == null ? "—" : `${pctVal}%`}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">({val})</span>
            </span>
        );
    };
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-(--border) text-left text-xs text-muted-foreground">
                        <th className="pb-2 px-2 font-medium">Cohort week</th>
                        <th className="pb-2 px-2 font-medium text-right">Size</th>
                        <th className="pb-2 px-2 font-medium text-center">D1</th>
                        <th className="pb-2 px-2 font-medium text-center">D7</th>
                        <th className="pb-2 px-2 font-medium text-center">D30</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                    {cohorts.map(c => (
                        <tr key={c.cohort_week} className="hover:bg-foreground/[0.03]">
                            <td className="py-2.5 px-2 font-medium text-foreground">{formatDate(c.cohort_week)}</td>
                            <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{c.size.toLocaleString()}</td>
                            <td className="py-2.5 px-2 text-center">{cell(c.d1, c.d1_pct, true)}</td>
                            <td className="py-2.5 px-2 text-center">{cell(c.d7, c.d7_pct, c.d7_elapsed)}</td>
                            <td className="py-2.5 px-2 text-center">{cell(c.d30, c.d30_pct, c.d30_elapsed)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ===========================================================================
// 3. HABIT & STREAKS
// ===========================================================================
export function StreakSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useStreaks(filters);
    const s = data?.summary;
    const dist = data?.distribution ?? [];

    return (
        <Section title="Habit & Streaks" description="Daily-habit consistency across the student base" icon={<Flame className="h-5 w-5" />}>
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard label="On an Active Streak" value={pct(s?.on_streak_pct)} icon={<Flame className="h-5 w-5" />} sub={`${n(s?.on_streak_now)} of ${n(s?.total_with_stats)} users`} info={EXPLAIN.onStreak} />
                <KpiCard label="Avg Current Streak" value={kpi(s?.avg_current_streak)} accent="blue" icon={<Activity className="h-5 w-5" />} sub="days" info={EXPLAIN.avgStreak} />
                <KpiCard label="Best Streak" value={kpi(s?.best_streak)} accent="purple" icon={<Trophy className="h-5 w-5" />} sub="days (all-time)" info={EXPLAIN.bestStreak} />
                <KpiCard label="Streak ≥ 7 / ≥ 30" value={`${n(s?.streak_7plus)} / ${n(s?.streak_30plus)}`} accent="pink" icon={<Star className="h-5 w-5" />} sub="committed users" info={EXPLAIN.streak7_30} />
            </KpiStrip>

            <Card title="Current-Streak Distribution" subtitle="How many students sit in each streak band" info={EXPLAIN.streakDist}>
                {loading ? (
                    <ChartSkeleton />
                ) : error ? (
                    <ErrorState {...errParts(error)} />
                ) : dist.length ? (
                    <HBarList data={dist} colorByIndex />
                ) : (
                    <EmptyState message="No study-stats rows for the current filters." />
                )}
            </Card>
        </Section>
    );
}

// ===========================================================================
// 4. FEATURE USAGE
// ===========================================================================
export function FeatureUsageSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useFeatures(filters);
    const potd = data?.potd;
    const ct = data?.customTest;
    const contest = data?.contest;
    const doubt = data?.doubt;
    const reach = data?.reach;

    const funnel = useMemo(
        () =>
            ct
                ? [
                      { label: "Not started", count: ct.not_started },
                      { label: "Active", count: ct.active },
                      { label: "Finished", count: ct.finished },
                  ]
                : [],
        [ct],
    );

    const reachBars = useMemo(
        () =>
            reach
                ? [
                      { label: "POTD", count: reach.potd_pct ?? 0 },
                      { label: "Custom Test", count: reach.custom_test_pct ?? 0 },
                      { label: "Contest", count: reach.contest_pct ?? 0 },
                      { label: "Doubt Forum", count: reach.doubt_pct ?? 0 },
                  ]
                : [],
        [reach],
    );

    return (
        <Section title="Feature Usage" description="Which features the active base actually touches" icon={<Layers className="h-5 w-5" />}>
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard label="POTD Participation" value={pct(potd?.participation_pct)} icon={<CalendarClock className="h-5 w-5" />} sub={potd?.potd_day ? `${n(potd.attempters)}/${n(potd.dau)} DAU · ${formatDate(potd.potd_day)}` : "latest POTD"} info={EXPLAIN.potdParticipation} />
                <KpiCard label="POTD Solve Rate" value={pct(potd?.solve_rate_pct)} accent="blue" icon={<CheckCircle2 className="h-5 w-5" />} sub="correct ÷ attempted" info={EXPLAIN.potdSolveRate} />
                <KpiCard label="Users Generating Tests" value={pct(ct?.generating_pct)} accent="purple" icon={<BookOpenCheck className="h-5 w-5" />} sub={`${n(ct?.users_with_test)} users · ${n(ct?.total_tests)} tests`} info={EXPLAIN.usersGeneratingTests} />
                <KpiCard label="Contest Missed Rate" value={pct(contest?.missed_pct)} accent="pink" icon={<AlertTriangle className="h-5 w-5" />} sub={`${n(contest?.participants)} participants`} info={EXPLAIN.contestMissed} />
            </KpiStrip>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Custom-Test Funnel" subtitle="not_started → active → finished" info={EXPLAIN.customTestFunnel}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : ct && ct.total_tests > 0 ? (
                        <HBarList data={funnel} colorByIndex valueFormatter={v => v.toLocaleString()} />
                    ) : (
                        <EmptyState message="No custom tests generated for the current filters." />
                    )}
                </Card>
                <Card title="Weekly Feature Reach" subtitle={reach ? `% of ${reach.wau.toLocaleString()} WAU touching each feature` : "% of WAU touching each feature"} info={EXPLAIN.featureReach}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : reach && reach.wau > 0 ? (
                        <HBarList data={reachBars} max={100} valueFormatter={v => `${v}%`} colorByIndex />
                    ) : (
                        <EmptyState message="No weekly active users to measure reach against." />
                    )}
                </Card>
                <Card title="Contests" subtitle="Participation & accuracy" info={EXPLAIN.contests}>
                    {loading ? (
                        <ChartSkeleton height={120} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : contest && contest.entries > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Stat label="Contests" value={contest.contests} />
                            <Stat label="Entries" value={contest.entries} />
                            <Stat label="Missed" value={`${contest.missed} (${pct(contest.missed_pct)})`} />
                            <Stat label="Avg Accuracy" value={pct(contest.avg_accuracy_pct)} />
                        </div>
                    ) : (
                        <EmptyState message="No contest leaderboard entries yet." />
                    )}
                </Card>
                <Card title="Doubt Forum" subtitle="Community Q&A activity" info={EXPLAIN.doubtForum}>
                    {loading ? (
                        <ChartSkeleton height={120} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : doubt && (doubt.posts > 0 || doubt.comments > 0) ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Stat label="Posts" value={doubt.posts} hint={`${doubt.posters} posters`} />
                            <Stat label="Comments" value={doubt.comments} />
                            <Stat label="Solved" value={doubt.solved} />
                            <Stat label="% Solved" value={pct(doubt.solved_pct)} />
                        </div>
                    ) : (
                        <EmptyState message="No doubt-forum posts or comments in range." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

// ===========================================================================
// 5. LEARNING OUTCOMES
// ===========================================================================
export function LearningOutcomesSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useOutcomes(filters);
    const s = data?.summary;

    const diffMix = useMemo(
        () =>
            s
                ? [
                      { label: "Easy", count: s.easy_solved },
                      { label: "Medium", count: s.medium_solved },
                      { label: "Hard", count: s.hard_solved },
                  ]
                : [],
        [s],
    );
    const hasDiff = diffMix.some(d => d.count > 0);

    const pyqMix = useMemo(
        () =>
            s
                ? [
                      { label: "Previous-year (PYQ)", count: s.pyq_solved },
                      { label: "Other questions", count: s.non_pyq_solved },
                  ]
                : [],
        [s],
    );
    const pyqShare = s && s.total_solved > 0 ? Math.round((100 * s.pyq_solved) / s.total_solved) : null;
    const solveRate = s && s.total_attempts > 0 ? Math.round((100 * s.total_solved) / s.total_attempts) : null;

    // Distributions of solved questions. Subject sums to Total Solved (1:1 path),
    // so we can show a % share; exam tags overlap, so it's shown as raw counts.
    const bySubject = data?.bySubject ?? [];
    const byExam = data?.byExam ?? [];
    const subjectTotal = bySubject.reduce((a, b) => a + b.count, 0);
    const subjectPct = (c: number) => (subjectTotal > 0 ? `${Math.round((100 * c) / subjectTotal)}%` : "");

    // Solved-over-time trend: cumulative growth line vs per-day bars.
    const [trendMode, setTrendMode] = useState<"cumulative" | "daily">("cumulative");
    const trend = useMemo(() => data?.trend ?? [], [data]);
    const trendLabels = useMemo(() => trend.map(p => p.day.slice(5)), [trend]);
    const cumulativeSeries = useMemo(() => trend.map(p => p.cumulative), [trend]);
    const dailySeries = useMemo(() => trend.map(p => p.solved), [trend]);

    return (
        <Section
            title="Learning Outcomes"
            description="Questions solved, PYQ coverage, accuracy and difficulty mix"
            icon={<BookOpenCheck className="h-5 w-5" />}
        >
            {/* Flagship, screenshot-friendly headline. */}
            <HeadlineBanner
                loading={loading}
                error={error}
                value={kpi(s?.total_solved)}
                caption={
                    s
                        ? `questions solved by students across ${n(s.total_attempts)} attempts${
                              pyqShare != null ? ` · ${pyqShare}% on real past-exam (PYQ) questions` : ""
                          }`
                        : "questions solved by students"
                }
                label="Total Questions Solved"
                icon={<Swords className="h-6 w-6" />}
                info={EXPLAIN.totalSolvedHero}
            />

            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard label="PYQs Solved" value={kpi(s?.pyq_solved)} icon={<GraduationCap className="h-5 w-5" />} sub={pyqShare != null ? `${pyqShare}% of all solves · real exam questions` : "previous-year exam questions"} info={EXPLAIN.pyqSolved} />
                <KpiCard label="Non-PYQs Solved" value={kpi(s?.non_pyq_solved)} accent="blue" icon={<BookOpenCheck className="h-5 w-5" />} sub="practice & concept questions" info={EXPLAIN.nonPyqSolved} />
                <KpiCard label="Overall Accuracy" value={pct(s?.avg_accuracy_pct)} accent="purple" icon={<CheckCircle2 className="h-5 w-5" />} sub="avg of per-user accuracy" info={EXPLAIN.overallAccuracy} />
                <KpiCard label="Total Attempts" value={kpi(s?.total_attempts)} accent="pink" icon={<Activity className="h-5 w-5" />} sub={solveRate != null ? `correct + wrong · ${solveRate}% solved` : "correct + wrong"} info={EXPLAIN.totalAttempts} />
            </KpiStrip>

            {/* Questions solved over time (the growth trend, "stocks" view). */}
            <Card
                title="Questions Solved Over Time"
                info={EXPLAIN.solvedTrend}
                subtitle={trendMode === "cumulative" ? "Cumulative solves (growth)" : "Solves per day (IST)"}
                right={
                    <div className="inline-flex rounded-lg border border-(--card-border) bg-foreground/5 p-0.5 text-xs">
                        {(["cumulative", "daily"] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setTrendMode(m)}
                                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                                    trendMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                }
            >
                {loading ? (
                    <ChartSkeleton height={240} />
                ) : error ? (
                    <ErrorState {...errParts(error)} />
                ) : trend.length >= 2 ? (
                    trendMode === "cumulative" ? (
                        <AreaChart points={cumulativeSeries} labels={trendLabels} height={240} valueLabel="total solved" />
                    ) : (
                        <AreaChart points={dailySeries} labels={trendLabels} height={240} valueLabel="solved that day" color="var(--color-accent-blue)" />
                    )
                ) : trend.length === 1 ? (
                    <EmptyState message="Only one day of solving activity so far. The trend line appears once there are at least two days." />
                ) : (
                    <EmptyState message="No solving activity in the selected range." />
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="PYQ vs Other" subtitle="Solves by source" info={EXPLAIN.pyqVsOther}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : s && s.total_solved > 0 ? (
                        <DonutChart data={pyqMix} />
                    ) : (
                        <EmptyState message="No solved questions for the current filters." />
                    )}
                </Card>
                <Card title="Difficulty Mix Solved" subtitle="Aggregate solved counts by difficulty" info={EXPLAIN.difficultyMix}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : hasDiff ? (
                        <DonutChart data={diffMix} />
                    ) : (
                        <EmptyState message="No solved-question difficulty data for the current filters." />
                    )}
                </Card>
            </div>

            {/* Distribution of solved questions by subject and by exam. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                    title="Solved by Subject"
                    subtitle="Share of total questions solved"
                    info={EXPLAIN.solvedBySubject}
                    right={subjectTotal > 0 ? <span className="text-xs text-muted-foreground">{subjectTotal.toLocaleString()} solves</span> : undefined}
                >
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : bySubject.length ? (
                        <HBarList data={bySubject} colorByIndex valueFormatter={c => `${c.toLocaleString()} · ${subjectPct(c)}`} />
                    ) : (
                        <EmptyState message="No solved questions for the current filters." />
                    )}
                </Card>
                <Card
                    title="Solved by Exam"
                    subtitle="Questions tagged for each exam (tags overlap)"
                    info={EXPLAIN.solvedByExam}
                >
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : byExam.length ? (
                        <HBarList data={byExam} colorByIndex valueFormatter={c => c.toLocaleString()} />
                    ) : (
                        <EmptyState message="No exam-tagged solves for the current filters." />
                    )}
                </Card>
            </div>

            {/* Weak-topics remain, but demoted below the flagship numbers. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KpiCard label="Users w/ Weak Topics" value={kpi(s?.users_with_weak_topics)} accent="purple" icon={<AlertTriangle className="h-5 w-5" />} sub="flagged for targeted review" info={EXPLAIN.weakTopicUsers} unavailable={s != null && s.users_with_weak_topics === 0} unavailableReason="No weak-topic rows recorded yet (feature just launched)." />
                <KpiCard label="Avg Weakness Score" value={kpi(s?.avg_weakness_score)} accent="pink" icon={<Activity className="h-5 w-5" />} sub="higher = weaker" info={EXPLAIN.avgWeakness} unavailable={s != null && s.avg_weakness_score == null} unavailableReason="No weak-topic rows to average yet." />
            </div>
        </Section>
    );
}

/** A large, screenshot-friendly hero number for the flagship metric. */
function HeadlineBanner({
    loading,
    error,
    value,
    caption,
    label,
    icon,
    info,
}: {
    loading: boolean;
    error: unknown;
    value: string;
    caption: string;
    label: string;
    icon: React.ReactNode;
    info?: string;
}) {
    if (error) {
        return (
            <div className="glass-card p-6">
                <ErrorState {...errParts(error)} />
            </div>
        );
    }
    return (
        <div className="glass-card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
            <div className="flex items-center gap-4">
                <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-muted-foreground">{label}</p>
                        {info && <InfoTip text={info} title={label} />}
                    </div>
                    {loading ? (
                        <Skeleton className="mt-1 h-11 w-40 rounded" />
                    ) : (
                        <p className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground tabular-nums leading-tight">{value}</p>
                    )}
                    {!loading && <p className="mt-1 text-sm text-muted-foreground">{caption}</p>}
                </div>
            </div>
        </div>
    );
}

// ===========================================================================
// 6. MONETIZATION & NOTIFICATIONS
// ===========================================================================
export function MonetizationSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useMonetization(filters);
    const s = data?.summary;

    const mix = useMemo(
        () =>
            s
                ? [
                      { label: "Free", count: s.free },
                      { label: "Premium", count: s.premium },
                  ]
                : [],
        [s],
    );

    return (
        <Section title="Monetization & Notifications" description="Plan mix, notification engagement and push reach" icon={<CreditCard className="h-5 w-5" />}>
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard label="Premium Share" value={pct(s?.premium_pct)} icon={<CreditCard className="h-5 w-5" />} sub={`${n(s?.premium)} premium · ${n(s?.free)} free`} info={EXPLAIN.premiumShare} />
                <KpiCard label="Notification Read Rate" value={pct(s?.notif_read_pct)} accent="blue" icon={<MessageSquare className="h-5 w-5" />} sub={`${n(s?.notif_read)} / ${n(s?.notif_total)} read`} info={EXPLAIN.notifReadRate} />
                <KpiCard label="Push Reachability" value={pct(s?.push_reach_pct)} accent="purple" icon={<Zap className="h-5 w-5" />} sub={`${n(s?.push_reachable_users)} of ${n(s?.total_students)} students`} info={EXPLAIN.pushReach} />
                <KpiCard label="Total Notifications" value={kpi(s?.notif_total)} accent="pink" icon={<MessageSquare className="h-5 w-5" />} sub="in selected range" info={EXPLAIN.totalNotifications} />
            </KpiStrip>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Free vs Premium" subtitle="Subscription mix of the student base" info={EXPLAIN.freeVsPremium}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : s && s.free + s.premium > 0 ? (
                        <DonutChart data={mix} />
                    ) : (
                        <EmptyState message="No students match the current filters." />
                    )}
                </Card>
                <Card title="App vs Web" subtitle="Students reached on each platform" info={EXPLAIN.appVsWeb}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : s && s.platform_users > 0 ? (
                        <div className="flex flex-col gap-5 pt-2">
                            <PlatformBar icon={<Smartphone className="h-4 w-4" />} label="Mobile app" users={s.app_users} pctVal={s.app_pct} color="var(--color-brand-500)" />
                            <PlatformBar icon={<Globe className="h-4 w-4" />} label="Web browser" users={s.web_users} pctVal={s.web_pct} color="var(--color-accent-blue)" />
                            <p className="text-[11px] text-muted-foreground/80">
                                {n(s.platform_users)} students with a login session. A student who uses both counts in both, so the two can exceed 100%.
                            </p>
                        </div>
                    ) : (
                        <EmptyState message="No login sessions to derive platform usage from." />
                    )}
                </Card>
                <Card title="Notification Engagement" subtitle="Read rate & push reachability" info={EXPLAIN.notifEngagement}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : s ? (
                        <div className="flex flex-col gap-5 pt-2">
                            <LabeledBar label="Read rate" value={s.notif_read_pct} />
                            <LabeledBar label="Push reachability" value={s.push_reach_pct} />
                            {s.premium === 0 && (
                                <UnavailablePill reason="No PREMIUM subscribers yet. Revenue metrics will populate once paid plans exist." />
                            )}
                        </div>
                    ) : (
                        <EmptyState message="No notification data in range." />
                    )}
                </Card>
                <Card title="Likely Churned" subtitle="Proxy for uninstalls (not confirmed)" info={EXPLAIN.likelyChurned}>
                    {loading ? (
                        <ChartSkeleton height={160} />
                    ) : error ? (
                        <ErrorState {...errParts(error)} />
                    ) : s ? (
                        <div className="flex flex-col gap-4 pt-1">
                            <div className="grid grid-cols-2 gap-4">
                                <Stat label="Lost app reachability" value={s.lost_reachability} hint="had push, now unreachable" />
                                <Stat label="Not seen 14+ days" value={s.lapsed_14d} hint="no active session" />
                            </div>
                            <p className="text-[11px] text-muted-foreground/80 leading-snug">
                                A true uninstall can&apos;t be detected (the app can&apos;t report its own removal). These are early-warning proxies, not exact uninstalls.
                            </p>
                        </div>
                    ) : (
                        <EmptyState message="No session data to estimate churn from." />
                    )}
                </Card>
            </div>
        </Section>
    );
}

function PlatformBar({ icon, label, users, pctVal, color }: { icon: React.ReactNode; label: string; users: number; pctVal: number | null; color: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
                <span className="font-semibold text-foreground tabular-nums">
                    {users.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">({pct(pctVal)})</span>
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pctVal ?? 0)}%`, background: color }} />
            </div>
        </div>
    );
}

function LabeledBar({ label, value }: { label: string; value: number | null }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground tabular-nums">{pct(value)}</span>
            </div>
            <ProgressBar value={value ?? 0} max={100} />
        </div>
    );
}

// NOTE: The "Most Active Users" section was moved out of Founder Analytics
// into the Leaderboard module — see
// `src/components/leaderboard/most-active-users.tsx`. It still reads the same
// `useActiveUsers` hook / `/api/analytics/active-users` route.


// ===========================================================================
// TIME SPENT
// ===========================================================================
/**
 * Time Spent — aggregate time-on-task, plus a daily/cumulative chart.
 *
 * Source: `question_attempts.time_taken` (server-side, keyed by user_id), so it
 * already aggregates across every device a student uses.
 *
 * It ALREADY INCLUDES contests, custom tests and scholarships: questions answered
 * in those flows write rows into `question_attempts` too (verified — a contest's
 * summed attempt time matches `contestleaderboard.total_time` to within a
 * second). So no per-feature time is added on top; that would double-count.
 *
 * The one thing it is not: total app screentime. The data has no session /
 * app-open signal, so idle, browsing and video time cannot be counted.
 */
type TimeMetric = "hours" | "solved" | "students";
type TimeMode = "daily" | "cumulative";

const TIME_METRICS: { key: TimeMetric; label: string }[] = [
    { key: "hours", label: "Time" },
    { key: "solved", label: "Questions" },
    { key: "students", label: "Students" },
];

export function TimeSpentSection({ filters }: { filters: Filters }) {
    const { data, error, loading } = useTimeSpent(filters);
    const s = data?.summary;
    const series = useMemo(() => data?.series ?? [], [data]);

    const [metric, setMetric] = useState<TimeMetric>("hours");
    const [mode, setMode] = useState<TimeMode>("daily");

    const testShare = s && s.totalHours > 0 ? Math.round((s.testHours / s.totalHours) * 100) : null;
    const labels = useMemo(() => series.map(p => p.day.slice(5)), [series]);

    // Daily values for the selected metric.
    const daily = useMemo(
        () => series.map(p => (metric === "hours" ? p.hours : metric === "solved" ? p.solved : p.students)),
        [series, metric],
    );

    // Cumulative values. Hours and questions are running sums. Students CANNOT be
    // summed (the same student is active on many days) — the server sends
    // `cumStudents`, a running count of distinct students first seen by that day.
    const cumulative = useMemo(() => {
        if (metric === "students") return series.map(p => p.cumStudents);
        return daily.map((_, i) => +daily.slice(0, i + 1).reduce((a, b) => a + b, 0).toFixed(1));
    }, [series, daily, metric]);

    const unit = metric === "hours" ? "hours" : metric === "solved" ? "questions" : "students";
    const bars = useMemo(
        () => series.map((p, i) => ({ label: p.day.slice(5), count: daily[i] })),
        [series, daily],
    );

    return (
        <Section
            title="Time Spent"
            description="Time students spend actively solving, combined across all their devices"
            icon={<Clock className="h-5 w-5" />}
        >
            <KpiStrip loading={loading} error={error} count={4}>
                <KpiCard
                    label="Total Time Spent"
                    value={humanHours(s?.totalHours)}
                    icon={<Hourglass className="h-5 w-5" />}
                    sub={s ? `${n(s.activeStudents)} of ${n(s.totalStudents)} students studied` : "students studied"}
                    info={EXPLAIN.totalTimeSpent}
                />
                <KpiCard
                    label="Avg / Median per Student"
                    value={`${kpi(s?.avgMinsPerStudent)} / ${kpi(s?.medianMinsPerStudent)}`}
                    accent="blue"
                    icon={<Gauge className="h-5 w-5" />}
                    sub="minutes"
                    info={EXPLAIN.avgTimePerStudent}
                />
                <KpiCard
                    label="Avg per Active Day"
                    value={kpi(s?.avgMinsPerActiveDay)}
                    accent="purple"
                    icon={<Activity className="h-5 w-5" />}
                    sub="minutes on a day they study"
                    info={EXPLAIN.avgTimePerActiveDay}
                />
                <KpiCard
                    label="Time in Tests"
                    value={humanHours(s?.testHours)}
                    accent="pink"
                    icon={<Layers className="h-5 w-5" />}
                    sub={testShare === null ? "of total" : `${testShare}% of total`}
                    info={EXPLAIN.testTimeShare}
                />
            </KpiStrip>

            <Card
                title="Activity Over Time"
                info={EXPLAIN.timeSeriesChart}
                subtitle={
                    mode === "cumulative"
                        ? `Cumulative ${unit} (growth)`
                        : `${unit[0].toUpperCase()}${unit.slice(1)} per day (IST)`
                }
                right={
                    <div className="flex items-center gap-2">
                        {/* Metric switch: time / questions / students */}
                        <div className="inline-flex rounded-lg border border-(--card-border) bg-foreground/5 p-0.5 text-xs">
                            {TIME_METRICS.map(m => (
                                <button
                                    key={m.key}
                                    onClick={() => setMetric(m.key)}
                                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                                        metric === m.key
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        {/* Daily vs cumulative */}
                        <div className="inline-flex rounded-lg border border-(--card-border) bg-foreground/5 p-0.5 text-xs">
                            {(["daily", "cumulative"] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                                        mode === m
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                }
            >
                {loading ? (
                    <ChartSkeleton />
                ) : error ? (
                    <ErrorState {...errParts(error)} />
                ) : series.length >= 2 ? (
                    mode === "cumulative" ? (
                        <AreaChart points={cumulative} labels={labels} valueLabel={`total ${unit}`} />
                    ) : (
                        <BarChart
                            data={bars}
                            color="var(--color-accent-blue)"
                            labelEvery={Math.max(1, Math.ceil(bars.length / 12))}
                        />
                    )
                ) : (
                    <EmptyState message="Not enough activity history to plot." />
                )}
            </Card>

            <p className="text-xs text-muted-foreground px-1">
                Measured from the time recorded against each question attempt, so it combines every
                device a student uses and already includes contests, custom tests and scholarships.
                It counts time spent solving, not total time the app is open: the app records no
                session signal, so idle, browsing and video time are not included.
            </p>
        </Section>
    );
}
