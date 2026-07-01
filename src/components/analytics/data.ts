"use client";

/**
 * Shared SWR hooks for the analytics dashboard. Every section reads from these
 * so a given endpoint is fetched at most once per refresh window (SWR dedupes by
 * key). All fetchers already swallow errors into empty results, so these hooks
 * report `isLoading` but never surface hard errors — the UI decides per-card
 * whether an empty result means "loading", "no data yet" or "not derivable".
 */

import useSWR from "swr";
import {
    fetchAllUsers,
    fetchArenaRanking,
    fetchClasses,
    fetchContests,
    fetchRatingRanking,
    fetchStreakRanking,
    fetchTopPerformers,
    type TimeFilter,
} from "@/lib/api/analytics";

const OPTS = {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 300_000, // 5 min — analytics data isn't real-time
    keepPreviousData: true,
};

export function useUsers() {
    const { data, isLoading, mutate } = useSWR("analytics:users", fetchAllUsers, OPTS);
    return { users: data ?? [], loading: isLoading, mutate };
}

export function useArena(time_filter?: TimeFilter, exam_type?: string) {
    const key = `analytics:arena:${time_filter ?? "all"}:${exam_type ?? ""}`;
    const { data, isLoading } = useSWR(key, () => fetchArenaRanking(time_filter, exam_type || undefined), OPTS);
    return { rows: data ?? [], loading: isLoading };
}

export function useRating(exam_type?: string) {
    const key = `analytics:rating:${exam_type ?? ""}`;
    const { data, isLoading } = useSWR(key, () => fetchRatingRanking(exam_type || undefined), OPTS);
    return { rows: data ?? [], loading: isLoading };
}

export function useStreak(exam_type?: string) {
    const key = `analytics:streak:${exam_type ?? ""}`;
    const { data, isLoading } = useSWR(key, () => fetchStreakRanking(exam_type || undefined), OPTS);
    return { rows: data ?? [], loading: isLoading };
}

export function useTopPerformers() {
    const { data, isLoading } = useSWR("analytics:top-performers", fetchTopPerformers, OPTS);
    return { top: data ?? null, loading: isLoading };
}

export function useContests() {
    const { data, isLoading } = useSWR("analytics:contests", fetchContests, OPTS);
    return { contests: data ?? [], loading: isLoading };
}

export function useClasses() {
    const { data, isLoading } = useSWR("analytics:classes", fetchClasses, OPTS);
    return { classes: data ?? [], loading: isLoading };
}
