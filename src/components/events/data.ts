"use client";

/**
 * SWR hook for the Events leaderboard. Fetches this app's own
 * `/api/events/:id/leaderboard` route (admin-gated, read-only Postgres), the
 * same pattern as the Founder Analytics hooks. Bearer token comes from the
 * stored admin session, identical to `src/lib/api/analytics.ts`.
 */

import useSWR from "swr";
import type { EventLeaderRow } from "@/lib/events/queries";

export interface EventLeaderboardData {
    leaderboard: EventLeaderRow[];
}

export class EventFetchError extends Error {
    constructor(public code: string, message: string, public status: number) {
        super(message);
        this.name = "EventFetchError";
    }
}

function authHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchLeaderboard(eventId: string): Promise<EventLeaderboardData> {
    const res = await fetch(`/api/events/${eventId}/leaderboard`, {
        headers: { ...authHeader() },
        cache: "no-store",
    });
    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON error page */
    }
    if (!res.ok) {
        const err = body as { error?: string; detail?: string } | null;
        throw new EventFetchError(err?.error ?? "http_error", err?.detail ?? res.statusText, res.status);
    }
    return (body as { data: EventLeaderboardData }).data;
}

const OPTS = {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
};

export function useEventLeaderboard(eventId: string) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<EventLeaderboardData>(
        eventId ? `events:leaderboard:${eventId}` : null,
        () => fetchLeaderboard(eventId),
        OPTS,
    );
    return { data, error, loading: isLoading, validating: isValidating, mutate };
}
