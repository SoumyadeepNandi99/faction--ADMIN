"use client";

/**
 * SWR hooks for the Founder Analytics dashboard. Each hook fetches one metric
 * group from this app's `/api/analytics/*` routes (which run read-only SQL on
 * the faction-backend DB). Keys embed the serialized filters so changing a
 * segmentation control refetches exactly the affected groups.
 *
 * Errors are surfaced (not swallowed) so each section can render a precise
 * error / not-configured state; SWR keeps the previous data during refetch.
 */

import useSWR from "swr";
import {
    filtersToQuery,
    getMetric,
    type ActivationData,
    type ActiveUsersData,
    type ClassesData,
    type EngagementData,
    type FeaturesData,
    type Filters,
    type MonetizationData,
    type OutcomesData,
    type StreaksData,
    type TimeSpentData,
} from "@/lib/api/analytics";

const OPTS = {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
    shouldRetryOnError: false, // don't hammer a misconfigured DB; the card shows the error
};

function useMetric<T>(group: string, path: string, filters: Filters) {
    const key = `analytics:${group}${filtersToQuery(filters)}`;
    const { data, error, isLoading, isValidating } = useSWR<T>(key, () => getMetric<T>(path, filters), OPTS);
    return { data, error, loading: isLoading, validating: isValidating };
}

export const useEngagement = (f: Filters) => useMetric<EngagementData>("engagement", "engagement", f);
export const useActivation = (f: Filters) => useMetric<ActivationData>("activation", "activation", f);
export const useStreaks = (f: Filters) => useMetric<StreaksData>("streaks", "streaks", f);
export const useFeatures = (f: Filters) => useMetric<FeaturesData>("features", "features", f);
export const useOutcomes = (f: Filters) => useMetric<OutcomesData>("outcomes", "outcomes", f);
export const useMonetization = (f: Filters) => useMetric<MonetizationData>("monetization", "monetization", f);
export const useActiveUsers = (f: Filters) => useMetric<ActiveUsersData>("active-users", "active-users", f);
export const useTimeSpent = (f: Filters) => useMetric<TimeSpentData>("time-spent", "time-spent", f);

export function useClasses() {
    const { data, error, isLoading } = useSWR<ClassesData>("analytics:classes", () => getMetric<ClassesData>("classes", { from: "", to: "", classId: "", examTypes: [], subscriptionType: "" }), {
        revalidateOnFocus: false,
        dedupingInterval: 600_000,
        shouldRetryOnError: false,
    });
    return { classes: data?.classes ?? [], error, loading: isLoading };
}
