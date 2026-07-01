"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { BarChart3, RefreshCw } from "lucide-react";
import { EMPTY_FILTERS, FilterBar, type Filters } from "@/components/analytics/filters";
import { Overview } from "@/components/analytics/overview";
import {
    ActivitySection,
    ContestSection,
    DemographicsSection,
    GrowthSection,
    ProblemSolvingSection,
    RatingSection,
    RetentionSection,
    StreakSection,
} from "@/components/analytics/sections";
import { LazyMount } from "@/components/analytics/primitives";
import { useClasses, useUsers } from "@/components/analytics/data";

export default function AnalyticsPage() {
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const { mutate } = useSWRConfig();
    const [refreshing, setRefreshing] = useState(false);

    const { users } = useUsers();
    const { classes } = useClasses();

    const classOptions = useMemo(() => classes.map(c => ({ label: c.name, value: c.id })), [classes]);
    const batchOptions = useMemo(() => {
        const set = new Set<string>();
        for (const u of users) if (u.batch) set.add(u.batch);
        return [...set].sort().map(b => ({ label: b, value: b }));
    }, [users]);

    const refresh = async () => {
        setRefreshing(true);
        // Revalidate every analytics SWR key.
        await mutate(key => typeof key === "string" && key.startsWith("analytics:"), undefined, { revalidate: true });
        setRefreshing(false);
    };

    return (
        <div className="flex flex-col gap-8 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Analytics</h1>
                        <p className="text-muted-foreground text-sm">
                            Product & growth health, derived live from platform data. All times in IST.
                        </p>
                    </div>
                </div>
                <button
                    onClick={refresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-xl glass-card px-4 py-2.5 text-sm font-medium text-foreground hover:border-brand-500/30 transition-all disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            <FilterBar filters={filters} onChange={setFilters} classOptions={classOptions} batchOptions={batchOptions} />

            <Overview filters={filters} />

            <LazyMount>
                <GrowthSection filters={filters} />
            </LazyMount>
            <LazyMount>
                <ProblemSolvingSection filters={filters} />
            </LazyMount>
            <LazyMount>
                <RatingSection filters={filters} />
            </LazyMount>
            <LazyMount>
                <StreakSection filters={filters} />
            </LazyMount>
            <LazyMount>
                <ContestSection />
            </LazyMount>
            <LazyMount>
                <DemographicsSection filters={filters} />
            </LazyMount>
            <LazyMount>
                <ActivitySection filters={filters} />
            </LazyMount>
            <LazyMount>
                <RetentionSection />
            </LazyMount>
        </div>
    );
}
