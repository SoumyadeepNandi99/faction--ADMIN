"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Trophy, TrendingUp, Flame, Award, Star, RefreshCw, ChevronDown, Timer, CalendarRange, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { MostActiveUsers } from "@/components/leaderboard/most-active-users";
import { Podium, type PodiumEntry } from "@/components/leaderboard/podium";
import { useClasses } from "@/components/analytics/data";
import { EMPTY_FILTERS, EXAM_TYPE_OPTIONS, type Filters } from "@/lib/api/analytics";

type RankingTab = "arena" | "rating" | "streak" | "contest" | "mostactive";

interface RankUser {
    user_id: string;
    user_name?: string;
    name?: string;
    avatar_url?: string | null;
    metric: number;
    max_metric?: number;
    badge?: string;
}

interface TopPerformers {
    best_rating?: { user: unknown; metric_value: number } | null;
    best_delta?: { user: unknown; metric_value: number } | null;
    best_questions?: { user: unknown; metric_value: number } | null;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
    // eslint-disable-next-line @next/next/no-img-element
    if (url) return <img src={url} alt={name} className="h-10 w-10 rounded-full object-cover" />;
    return (
        <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20 text-sm">
            {name?.[0] || "?"}
        </div>
    );
}

type Tab = {
    key: RankingTab;
    label: string;
    icon: React.ReactNode;
    // API-backed tabs only:
    endpoint?: string;
    metricKey?: string;
    metricLabel?: string;
    maxMetricKey?: string;
    supportsTimeFilter?: boolean;
    // Which filters this tab's data source actually honours:
    supportsExam: boolean;
    supportsClass: boolean;
    supportsDate: boolean;
};

const tabs: Tab[] = [
    { key: "arena", label: "Arena (Questions)", icon: <Trophy className="h-4 w-4" />, endpoint: "/api/v1/arena-ranking/", metricKey: "questions_solved", metricLabel: "solved", supportsExam: true, supportsClass: false, supportsDate: false, supportsTimeFilter: true },
    { key: "rating", label: "Rating", icon: <Star className="h-4 w-4" />, endpoint: "/api/v1/rating-ranking/", metricKey: "current_rating", metricLabel: "rating", maxMetricKey: "max_rating", supportsExam: true, supportsClass: false, supportsDate: false },
    { key: "streak", label: "Streak", icon: <Flame className="h-4 w-4" />, endpoint: "/api/v1/streak-ranking/", metricKey: "current_streak", metricLabel: "days", maxMetricKey: "longest_streak", supportsExam: true, supportsClass: false, supportsDate: false },
    { key: "contest", label: "Contest", icon: <Award className="h-4 w-4" />, endpoint: "/api/v1/contest-ranking/", metricKey: "score", metricLabel: "pts", supportsExam: true, supportsClass: false, supportsDate: false },
    { key: "mostactive", label: "Most Active Users", icon: <Timer className="h-4 w-4" />, supportsExam: true, supportsClass: true, supportsDate: true },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const PAGE_SIZE = 50;

const TIME_FILTER_OPTIONS = [
    { label: "All Time", value: "" },
    { label: "This Week", value: "week" },
    { label: "Today", value: "day" },
];

// --- Most Active Users quick ranges (write real IST dates into from/to) ------
// The active-users route buckets by IST, so quick ranges resolve to IST
// YYYY-MM-DD strings. "All Time" clears both (no window).
type QuickRangeKey = "all" | "today" | "week" | "month";

/** Today in IST as YYYY-MM-DD. */
function istToday(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
/** N days before IST-today as YYYY-MM-DD. */
function istDaysAgo(n: number): string {
    const now = new Date();
    const shifted = new Date(now.getTime() - n * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(shifted);
}

/** Map a quick-range key to a {from, to} pair (empty strings = all time). */
function quickRangeToDates(key: QuickRangeKey): { from: string; to: string } {
    const to = istToday();
    switch (key) {
        case "today": return { from: to, to };
        case "week": return { from: istDaysAgo(6), to };   // last 7 days incl. today
        case "month": return { from: istDaysAgo(29), to }; // last 30 days incl. today
        case "all":
        default: return { from: "", to: "" };
    }
}

const MOST_ACTIVE_RANGES: { label: string; key: QuickRangeKey }[] = [
    { label: "All Time", key: "all" },
    { label: "Today", key: "today" },
    { label: "This Week", key: "week" },
    { label: "This Month", key: "month" },
];

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState<RankingTab>("arena");
    const [users, setUsers] = useState<RankUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [total, setTotal] = useState(0);
    const [topPerformers, setTopPerformers] = useState<TopPerformers | null>(null);

    // Unified filter state (analytics shape). API tabs use only examTypes[0];
    // Most Active Users uses the whole thing (Exam multi + Class + Date range).
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [timeFilter, setTimeFilter] = useState(""); // arena-only preset bucket

    const { classes } = useClasses();
    const classOptions = useMemo(() => classes.map(c => ({ label: c.name, value: c.id })), [classes]);

    const tab = tabs.find(t => t.key === activeTab)!;
    const isApiTab = Boolean(tab.endpoint);

    const setFilter = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));

    // ---- API-tab ranking fetch (arena/rating/streak/contest) ----------------
    const fetchRanking = useCallback(async (skip: number, append: boolean) => {
        if (!tab.endpoint) return;
        if (append) setLoadingMore(true); else setLoading(true);
        setError(false);
        try {
            const params: Record<string, string | number> = { limit: PAGE_SIZE, skip };
            // Only Exam is honoured by the FastAPI ranking endpoints (single value).
            const exam = filters.examTypes[0];
            if (tab.supportsExam && exam) params.exam_type = exam;
            if (tab.supportsTimeFilter && timeFilter) params.time_filter = timeFilter;

            const res = await apiClient.get(tab.endpoint, { params });
            const data = res.data;
            const rawUsers: Record<string, unknown>[] = data.users || data.rankings || [];
            const mapped: RankUser[] = rawUsers.map((u) => ({
                user_id: (u.user_id || u.id) as string,
                user_name: (u.user_name || u.name) as string | undefined,
                avatar_url: u.avatar_url as string | null | undefined,
                metric: (u[tab.metricKey!] ?? u.score ?? u.metric_value ?? 0) as number,
                max_metric: tab.maxMetricKey ? (u[tab.maxMetricKey] as number | undefined) : undefined,
                badge: u.title as string | undefined,
            }));
            setUsers(prev => append ? [...prev, ...mapped] : mapped);
            setTotal(data.total ?? mapped.length);
        } catch {
            setError(true);
            if (!append) setUsers([]);
        } finally {
            if (append) setLoadingMore(false); else setLoading(false);
        }
    }, [tab, filters.examTypes, timeFilter]);

    useEffect(() => {
        if (!isApiTab) return;
        setUsers([]);
        fetchRanking(0, false);
    }, [fetchRanking, isApiTab]);

    useEffect(() => {
        apiClient.get("/api/v1/leaderboard/top-performers")
            .then(r => setTopPerformers(r.data))
            .catch(() => { });
    }, []);

    // Contextual top performer per tab (API tabs only).
    const tabTopPerformer = (() => {
        if (!topPerformers) return null;
        const pick = (tp: { user: unknown; metric_value: number } | null | undefined, label: string) => {
            if (!tp) return null;
            const user = tp.user as { name?: string; user_name?: string } | undefined;
            return { name: user?.name || user?.user_name, metric: tp.metric_value, label };
        };
        if (activeTab === "rating") return pick(topPerformers.best_rating, "rating");
        if (activeTab === "arena") return pick(topPerformers.best_questions, "solved");
        // The top-performers endpoint carries no "top streak" field, so the streak
        // tab has no contextual chip — the podium + table already surface the
        // leading streaks (previously this mis-showed the rating-delta leader).
        return null;
    })();

    const handleTabChange = (key: RankingTab) => {
        setActiveTab(key);
        setTimeFilter("");
    };

    // Podium entries for API tabs (top 3 of the fetched list).
    const apiPodium: PodiumEntry[] = users.slice(0, 3).map(u => ({
        id: u.user_id,
        name: u.user_name || "Unknown",
        avatar_url: u.avatar_url,
        metric: u.metric?.toLocaleString() ?? "0",
        metricUnit: tab.metricLabel,
    }));

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Leaderboard</h1>
                    <p className="text-muted-foreground">Top-performing students across all ranking categories.</p>
                </div>
                {tabTopPerformer && (
                    <div className="glass-card px-4 py-3 flex items-center gap-3 border-brand-500/20">
                        <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground">Top Performer</p>
                            <p className="text-sm font-bold text-foreground">{tabTopPerformer.name} · {tabTopPerformer.metric?.toLocaleString()} {tabTopPerformer.label}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => handleTabChange(t.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.key ? "bg-brand-500 text-white shadow-sm shadow-brand-500/20" : "glass-card text-muted-foreground hover:text-foreground"}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Unified filter bar — Exam, Class, Date on every tab. Filters the
                data source doesn't support are shown disabled with a note. */}
            <FilterBar
                tab={tab}
                filters={filters}
                onChange={setFilter}
                classOptions={classOptions}
                timeFilter={timeFilter}
                onTimeFilter={setTimeFilter}
                timeFilterOptions={TIME_FILTER_OPTIONS}
            />

            {activeTab === "mostactive" ? (
                <MostActiveUsers filters={filters} hideActiveDays={Boolean(filters.from || filters.to)} />
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Podium (top 3) for the active API tab */}
                    {!loading && !error && users.length > 0 && (
                        <Podium top3={apiPodium} unit={tab.metricLabel} />
                    )}

                    <div className="glass-card overflow-hidden">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex items-center gap-4 p-3">
                                        <Skeleton className="h-8 w-8 rounded-full" />
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40 rounded" /><Skeleton className="h-3 w-24 rounded" /></div>
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="p-12 text-center flex flex-col items-center gap-3">
                                <RefreshCw className="h-8 w-8 text-destructive/50" />
                                <p className="text-foreground font-semibold">Failed to load rankings</p>
                                <p className="text-sm text-muted-foreground">Could not fetch data from the server.</p>
                                <button onClick={() => fetchRanking(0, false)}
                                    className="mt-1 text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer">
                                    Retry
                                </button>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">No ranking data available for this category.</div>
                        ) : (
                            <>
                                <div className="divide-y divide-(--border)">
                                    {users.map((u, i) => (
                                        <div key={u.user_id} className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors ${i < 3 ? "bg-brand-500/5" : ""}`}>
                                            <span className="w-8 text-center text-lg font-bold">
                                                {i < 3 ? MEDALS[i] : <span className="text-sm text-muted-foreground font-mono">{i + 1}</span>}
                                            </span>
                                            <Avatar name={u.user_name || "?"} url={u.avatar_url} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-foreground truncate">
                                                    {u.user_name || "Unknown"}
                                                    <span className="ml-2 text-sm font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                                                        {u.metric?.toLocaleString()}
                                                    </span>
                                                </p>
                                                {u.badge && <p className="text-xs text-muted-foreground">{u.badge}</p>}
                                                {u.max_metric !== undefined && (
                                                    <p className="text-xs text-muted-foreground">Peak: {u.max_metric?.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full text-sm font-bold">
                                                <TrendingUp className="h-3 w-3" />
                                                {u.metric?.toLocaleString()} {tab.metricLabel}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {users.length < total && (
                                    <div className="p-4 text-center border-t border-(--border)">
                                        <button
                                            onClick={() => fetchRanking(users.length, true)}
                                            disabled={loadingMore}
                                            className="flex items-center gap-2 mx-auto text-sm text-brand-500 hover:text-brand-400 font-medium transition-colors cursor-pointer disabled:opacity-50">
                                            {loadingMore ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                                            {loadingMore ? "Loading…" : `Load more (${total - users.length} remaining)`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Filter bar — Exam / Class / Date on every tab. Unsupported controls render
// disabled with a "not supported for this ranking" hint. Arena also keeps its
// preset week/day bucket.
// ---------------------------------------------------------------------------
function FilterBar({
    tab,
    filters,
    onChange,
    classOptions,
    timeFilter,
    onTimeFilter,
    timeFilterOptions,
}: {
    tab: Tab;
    filters: Filters;
    onChange: (patch: Partial<Filters>) => void;
    classOptions: { label: string; value: string }[];
    timeFilter: string;
    onTimeFilter: (v: string) => void;
    timeFilterOptions: { label: string; value: string }[];
}) {
    const disabledNote = "Not supported for this ranking";

    return (
        <div className="glass-card p-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Exam (multi-select). API tabs only use the first selected value. */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Exam</span>
                    <CustomMultiSelect
                        value={filters.examTypes}
                        onChange={v => onChange({ examTypes: v })}
                        options={EXAM_TYPE_OPTIONS}
                        placeholder="All Exams"
                    />
                    {tab.supportsExam && !tab.supportsClass && filters.examTypes.length > 1 && (
                        <span className="text-[11px] text-muted-foreground/70">This ranking uses only the first exam.</span>
                    )}
                </div>

                {/* Class */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        Class
                        {!tab.supportsClass && <Info className="h-3 w-3 text-muted-foreground/50" />}
                    </span>
                    <div title={tab.supportsClass ? undefined : disabledNote}>
                        <CustomSelect
                            value={tab.supportsClass ? filters.classId : ""}
                            onChange={v => onChange({ classId: v })}
                            options={[{ label: "All Classes", value: "" }, ...classOptions]}
                            placeholder="All Classes"
                            disabled={!tab.supportsClass}
                        />
                    </div>
                    {!tab.supportsClass && <span className="text-[11px] text-muted-foreground/60">{disabledNote}</span>}
                </div>

                {/* Date range */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" /> From
                        {!tab.supportsDate && <Info className="h-3 w-3 text-muted-foreground/50" />}
                    </span>
                    <input
                        type="date"
                        disabled={!tab.supportsDate}
                        title={tab.supportsDate ? undefined : disabledNote}
                        value={tab.supportsDate ? filters.from : ""}
                        max={filters.to || undefined}
                        onChange={e => onChange({ from: e.target.value })}
                        className="rounded-xl bg-foreground/5 border border-(--card-border) px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!tab.supportsDate && <span className="text-[11px] text-muted-foreground/60">{disabledNote}</span>}
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarRange className="h-3 w-3" /> To
                    </span>
                    <input
                        type="date"
                        disabled={!tab.supportsDate}
                        title={tab.supportsDate ? undefined : disabledNote}
                        value={tab.supportsDate ? filters.to : ""}
                        min={filters.from || undefined}
                        onChange={e => onChange({ to: e.target.value })}
                        className="rounded-xl bg-foreground/5 border border-(--card-border) px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                </div>
            </div>

            {/* Arena keeps its quick week/day bucket (API time_filter). */}
            {tab.supportsTimeFilter && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Quick range:</span>
                    {timeFilterOptions.map(o => (
                        <button
                            key={o.value}
                            onClick={() => onTimeFilter(o.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${timeFilter === o.value ? "bg-brand-500 text-white" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Most Active Users quick ranges write real IST dates into from/to. */}
            {tab.supportsDate && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Quick range:</span>
                    {MOST_ACTIVE_RANGES.map(r => {
                        const d = quickRangeToDates(r.key);
                        const active = filters.from === d.from && filters.to === d.to;
                        return (
                            <button
                                key={r.key}
                                onClick={() => onChange(d)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${active ? "bg-brand-500 text-white" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}
                            >
                                {r.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
