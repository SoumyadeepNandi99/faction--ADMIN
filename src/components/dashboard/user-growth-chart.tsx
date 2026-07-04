"use client";

/**
 * A large, investor-shareable "Total Users over time" growth chart for the
 * Dashboard. Shows the cumulative count of registered students as a line, ending
 * at the current total. Data comes from the analytics engagement endpoint's
 * per-day signup series (read-only over the platform DB); the cumulative line is
 * a running sum of that. Degrades gracefully if the analytics DB isn't connected.
 */

import { useMemo } from "react";
import useSWR from "swr";
import { Users, TrendingUp, RefreshCw } from "lucide-react";
import { AreaChart } from "@/components/analytics/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsFetchError, EMPTY_FILTERS, getMetric, type EngagementData } from "@/lib/api/analytics";

export function UserGrowthChart() {
    const { data, error, isLoading } = useSWR(
        "dashboard:user-growth",
        () => getMetric<EngagementData>("engagement", EMPTY_FILTERS),
        { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
    );

    const signups = useMemo(() => data?.signups ?? [], [data]);
    // Running total of registered students per IST day.
    const cumulative = useMemo(() => {
        const vals = signups.map(p => p.value);
        return vals.map((_, i) => vals.slice(0, i + 1).reduce((a, b) => a + b, 0));
    }, [signups]);
    const labels = useMemo(() => signups.map(p => p.day.slice(5)), [signups]);
    const totalUsers = cumulative.length ? cumulative[cumulative.length - 1] : (data?.summary.total_students ?? 0);
    const firstDay = signups[0]?.day;
    const lastDay = signups[signups.length - 1]?.day;

    const notConfigured = error instanceof AnalyticsFetchError && error.code === "not_configured";

    return (
        <div className="glass-card relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col gap-6">
                {/* Hero header: the big number */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
                            <Users className="h-7 w-7" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                            {isLoading ? (
                                <Skeleton className="mt-1 h-11 w-40 rounded" />
                            ) : (
                                <p className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground tabular-nums leading-tight">
                                    {totalUsers.toLocaleString()}
                                </p>
                            )}
                            {!isLoading && !error && firstDay && lastDay && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    registered students · {firstDay} to {lastDay}
                                </p>
                            )}
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                        <TrendingUp className="h-3.5 w-3.5" /> Growth
                    </span>
                </div>

                {/* The line */}
                {isLoading ? (
                    <Skeleton className="w-full rounded-xl" style={{ height: 280 }} />
                ) : error ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                        <RefreshCw className="h-7 w-7 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {notConfigured
                                ? "Connect the analytics database (ANALYTICS_DATABASE_URL) to plot user growth."
                                : "Couldn't load the growth chart right now."}
                        </p>
                    </div>
                ) : cumulative.length >= 2 ? (
                    <AreaChart points={cumulative} labels={labels} height={280} valueLabel="total users" />
                ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                        <Users className="h-7 w-7 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Not enough signup history to plot growth yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
