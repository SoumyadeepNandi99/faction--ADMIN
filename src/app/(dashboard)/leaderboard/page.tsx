"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import { Trophy, TrendingUp, Flame, Award, Star, RefreshCw, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomSelect } from "@/components/ui/custom-select";
import { MostActiveUsers } from "@/components/leaderboard/most-active-users";

type RankingTab = "arena" | "rating" | "streak" | "contest";

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
    best_rating?: { user: any; metric_value: number } | null;
    best_delta?: { user: any; metric_value: number } | null;
    best_questions?: { user: any; metric_value: number } | null;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
    if (url) return <img src={url} alt={name} className="h-10 w-10 rounded-full object-cover" />;
    return (
        <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold border border-brand-500/20 text-sm">
            {name?.[0] || "?"}
        </div>
    );
}

const tabs: { key: RankingTab; label: string; icon: React.ReactNode; endpoint: string; metricKey: string; metricLabel: string; maxMetricKey?: string; supportsExamType: boolean; supportsTimeFilter: boolean }[] = [
    { key: "arena", label: "Arena (Questions)", icon: <Trophy className="h-4 w-4" />, endpoint: "/api/v1/arena-ranking/", metricKey: "questions_solved", metricLabel: "solved", supportsExamType: true, supportsTimeFilter: true },
    { key: "rating", label: "Rating", icon: <Star className="h-4 w-4" />, endpoint: "/api/v1/rating-ranking/", metricKey: "current_rating", metricLabel: "rating", maxMetricKey: "max_rating", supportsExamType: true, supportsTimeFilter: false },
    { key: "streak", label: "Streak", icon: <Flame className="h-4 w-4" />, endpoint: "/api/v1/streak-ranking/", metricKey: "streak_count", metricLabel: "days", supportsExamType: true, supportsTimeFilter: false },
    { key: "contest", label: "Contest", icon: <Award className="h-4 w-4" />, endpoint: "/api/v1/contest-ranking/", metricKey: "score", metricLabel: "pts", supportsExamType: false, supportsTimeFilter: false },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const PAGE_SIZE = 50;

const EXAM_TYPE_OPTIONS = [
    { label: "All Exams", value: "" },
    { label: "JEE Mains", value: "JEE_MAINS" },
    { label: "JEE Advanced", value: "JEE_ADVANCED" },
    { label: "NEET", value: "NEET" },
    { label: "Boards", value: "BOARDS" },
];

const TIME_FILTER_OPTIONS = [
    { label: "All Time", value: "" },
    { label: "This Week", value: "week" },
    { label: "Today", value: "day" },
];

export default function LeaderboardPage() {
    const [activeTab, setActiveTab] = useState<RankingTab>("arena");
    const [users, setUsers] = useState<RankUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [total, setTotal] = useState(0);
    const [topPerformers, setTopPerformers] = useState<TopPerformers | null>(null);

    // Fix #4 & #5: filter state
    const [examType, setExamType] = useState("");
    const [timeFilter, setTimeFilter] = useState("");

    const tab = tabs.find(t => t.key === activeTab)!;

    // Fix #3: fetch inlined in useCallback with all deps explicit
    const fetchRanking = useCallback(async (skip: number, append: boolean) => {
        if (append) setLoadingMore(true); else setLoading(true);
        setError(false);
        try {
            const params: Record<string, any> = { limit: PAGE_SIZE, skip };
            if (tab.supportsExamType && examType) params.exam_type = examType;
            if (tab.supportsTimeFilter && timeFilter) params.time_filter = timeFilter;

            const res = await apiClient.get(tab.endpoint, { params });
            const data = res.data;
            const rawUsers: any[] = data.users || data.rankings || [];
            const mapped: RankUser[] = rawUsers.map((u: any) => ({
                user_id: u.user_id || u.id,
                user_name: u.user_name || u.name,
                avatar_url: u.avatar_url,
                metric: u[tab.metricKey] ?? u.score ?? u.metric_value ?? 0,
                // Fix #6: capture max_metric if present
                max_metric: tab.maxMetricKey ? u[tab.maxMetricKey] : undefined,
                badge: u.title,
            }));
            setUsers(prev => append ? [...prev, ...mapped] : mapped);
            setTotal(data.total ?? mapped.length);
        } catch {
            setError(true);
            if (!append) setUsers([]);
        } finally {
            if (append) setLoadingMore(false); else setLoading(false);
        }
    }, [tab, examType, timeFilter]);

    useEffect(() => {
        setUsers([]);
        fetchRanking(0, false);
    }, [fetchRanking]);

    useEffect(() => {
        // Fix #1: correct field name best_questions (not most_questions_solved)
        apiClient.get("/api/v1/leaderboard/top-performers")
            .then(r => setTopPerformers(r.data))
            .catch(() => { });
    }, []);

    // Fix #7: pick the contextually relevant top performer per tab
    const tabTopPerformer = (() => {
        if (!topPerformers) return null;
        if (activeTab === "rating") {
            const tp = topPerformers.best_rating;
            if (!tp) return null;
            return { name: tp.user?.name || tp.user?.user_name, metric: tp.metric_value, label: "rating" };
        }
        if (activeTab === "arena") {
            const tp = topPerformers.best_questions;
            if (!tp) return null;
            return { name: tp.user?.name || tp.user?.user_name, metric: tp.metric_value, label: "solved" };
        }
        if (activeTab === "streak") {
            const tp = topPerformers.best_delta;
            if (!tp) return null;
            return { name: tp.user?.name || tp.user?.user_name, metric: tp.metric_value, label: "delta" };
        }
        return null;
    })();

    const handleTabChange = (key: RankingTab) => {
        setActiveTab(key);
        setExamType("");
        setTimeFilter("");
    };

    return (
        <>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Leaderboard</h1>
                        <p className="text-muted-foreground">Top-performing students across all ranking categories.</p>
                    </div>
                    {/* Fix #7: contextual top performer per tab */}
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

                {/* Fix #4 & #5: filter bar */}
                {(tab.supportsExamType || tab.supportsTimeFilter) && (
                    <div className="glass-card p-3 flex flex-wrap items-center gap-3">
                        {tab.supportsExamType && (
                            <div className="w-44">
                                <CustomSelect value={examType} onChange={setExamType} options={EXAM_TYPE_OPTIONS} placeholder="All Exams" />
                            </div>
                        )}
                        {tab.supportsTimeFilter && (
                            <div className="w-36">
                                <CustomSelect value={timeFilter} onChange={setTimeFilter} options={TIME_FILTER_OPTIONS} placeholder="All Time" />
                            </div>
                        )}
                    </div>
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
                        /* Fix #2: distinct error state */
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
                                            <p className="font-semibold text-foreground truncate">{u.user_name || "Unknown"}</p>
                                            {u.badge && <p className="text-xs text-muted-foreground">{u.badge}</p>}
                                            {/* Fix #6: max_rating secondary line */}
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
                            {/* Fix #8: load more */}
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

                {/* Most Active Users — podium + ranked list (moved from Founder Analytics) */}
                <MostActiveUsers />
            </div>
        </>
    );
}
