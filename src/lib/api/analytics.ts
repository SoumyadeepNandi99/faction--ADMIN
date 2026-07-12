"use client";

/**
 * Founder Analytics — CLIENT data layer.
 *
 * The metrics on this dashboard are aggregate SQL over the faction-backend
 * Postgres DB (DAU/MAU, retention cohorts, feature funnels, …). The admin app's
 * REST API does not expose those, and we can't add backend endpoints, so the
 * queries run in *this* app's own server routes (`/api/analytics/*`, see
 * src/lib/analytics/*) against a strictly read-only DB connection.
 *
 * This module is the thin browser-side client for those routes:
 *   - it attaches the admin JWT (same token the rest of the panel uses),
 *   - it fetches from the admin app's OWN origin (not the FastAPI backend),
 *   - it normalises the { data } | { error } envelope into a typed result so
 *     each card can show loading / empty / error / not-configured states.
 */

import { EXAM_TYPE_OPTIONS } from "@/lib/exam-types";

// ---------------------------------------------------------------------------
// Shared filter shape (mirrors the server AnalyticsFilters)
// ---------------------------------------------------------------------------
export interface Filters {
    from: string; // "YYYY-MM-DD" or ""
    to: string; // "YYYY-MM-DD" or ""
    classId: string; // "" = all
    examTypes: string[]; // [] = all
    subscriptionType: string; // "" | "FREE" | "PREMIUM"
}

export const EMPTY_FILTERS: Filters = { from: "", to: "", classId: "", examTypes: [], subscriptionType: "" };

export function hasActiveFilters(f: Filters): boolean {
    return Boolean(f.from || f.to || f.classId || f.examTypes.length || f.subscriptionType);
}

export function filtersToQuery(f: Filters): string {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.classId) p.set("classId", f.classId);
    if (f.subscriptionType) p.set("subscriptionType", f.subscriptionType);
    if (f.examTypes.length) p.set("examTypes", f.examTypes.join(","));
    const s = p.toString();
    return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Fetch envelope
// ---------------------------------------------------------------------------
export type ApiError = { code: string; detail: string };

export class AnalyticsFetchError extends Error {
    constructor(public code: string, public detail: string, public status: number) {
        super(detail || code);
        this.name = "AnalyticsFetchError";
    }
}

function authHeader(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * GET a metric endpoint on this app's origin. Throws AnalyticsFetchError with a
 * stable `code` so SWR error handling can distinguish "not configured" (needs
 * the DB URL) from a real query failure or an auth problem.
 */
export async function getMetric<T>(path: string, filters: Filters): Promise<T> {
    const res = await fetch(`/api/analytics/${path}${filtersToQuery(filters)}`, {
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
        throw new AnalyticsFetchError(err?.error ?? "http_error", err?.detail ?? res.statusText, res.status);
    }
    return (body as { data: T }).data;
}

// ---------------------------------------------------------------------------
// Broadcast segments — audience lists for targeted notifications. These live on
// the same read-only analytics routes but return their payload un-enveloped, so
// they get their own fetchers.
// ---------------------------------------------------------------------------
export interface SegmentDef { key: string; label: string; description: string; }
export interface ResolvedSegment { segment: string; count: number; userIds: string[]; }

async function getSegmentsJson<T>(query: string): Promise<T> {
    const res = await fetch(`/api/analytics/segments${query}`, { headers: { ...authHeader() }, cache: "no-store" });
    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON */
    }
    if (!res.ok) {
        const err = body as { error?: string; detail?: string } | null;
        throw new AnalyticsFetchError(err?.error ?? "http_error", err?.detail ?? res.statusText, res.status);
    }
    return body as T;
}

/** The catalogue of available segments (labels + descriptions). */
export async function fetchSegments(): Promise<SegmentDef[]> {
    const { segments } = await getSegmentsJson<{ segments: SegmentDef[] }>("");
    return segments;
}

/** Resolve a segment to its concrete audience (count + user IDs). */
export async function resolveSegment(key: string): Promise<ResolvedSegment> {
    return getSegmentsJson<ResolvedSegment>(`?segment=${encodeURIComponent(key)}`);
}

// ---------------------------------------------------------------------------
// Class-wise broadcast audience — pick a class, resolve to its students. Uses
// the same read-only analytics routes (segments route with ?classId=), so the
// resolved user IDs feed the existing admin/send endpoint just like segments.
// ---------------------------------------------------------------------------
export interface ClassOption { id: string; name: string; }
export interface ResolvedClass { classId: string; count: number; userIds: string[]; }

/** The list of classes (id + name) to pick from for class-wise broadcasts. */
export async function fetchClasses(): Promise<ClassOption[]> {
    // The /api/analytics/classes route returns { classes: [...] } inside the
    // standard metric envelope; getMetric unwraps the envelope for us.
    const { classes } = await getMetric<{ classes: ClassOption[] }>("classes", EMPTY_FILTERS);
    return classes ?? [];
}

/** Resolve a class to its concrete audience (count + user IDs). */
export async function resolveClass(classId: string): Promise<ResolvedClass> {
    return getSegmentsJson<ResolvedClass>(`?classId=${encodeURIComponent(classId)}`);
}

// ---------------------------------------------------------------------------
// Faction Legends — per-student challenge progress (correct solves since the
// event launched, scoped to each student's stream subjects). Read-only.
// ---------------------------------------------------------------------------
export type LegendsStream = "JEE" | "NEET" | "FOUNDATION";
export interface LegendsProgressRow {
    userId: string;
    name: string | null;
    className: string | null;
    stream: LegendsStream;
    progress: number;
    target: number;
    pct: number;
}

/** Fetch Legends progress rows; pass a stream to filter, or "" for all. */
export async function fetchLegendsProgress(stream?: string): Promise<LegendsProgressRow[]> {
    const qs = stream ? `?stream=${encodeURIComponent(stream)}` : "";
    const res = await fetch(`/api/analytics/legends${qs}`, { headers: { ...authHeader() }, cache: "no-store" });
    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON */
    }
    if (!res.ok) {
        const err = body as { error?: string; detail?: string } | null;
        throw new AnalyticsFetchError(err?.error ?? "http_error", err?.detail ?? res.statusText, res.status);
    }
    return (body as { data: { rows: LegendsProgressRow[] } }).data.rows ?? [];
}

/**
 * Fetch a { userId: lastActiveISO|null } map for the Users table's "Last Active"
 * column. Read-only, admin-gated. Throws AnalyticsFetchError on failure so the
 * caller can degrade to "—".
 */
export async function fetchLastActiveMap(): Promise<Record<string, string | null>> {
    const res = await fetch(`/api/analytics/last-active`, { headers: { ...authHeader() }, cache: "no-store" });
    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* non-JSON */
    }
    if (!res.ok) {
        const err = body as { error?: string; detail?: string } | null;
        throw new AnalyticsFetchError(err?.error ?? "http_error", err?.detail ?? res.statusText, res.status);
    }
    return (body as { lastActive: Record<string, string | null> }).lastActive ?? {};
}

// ---------------------------------------------------------------------------
// Response shapes (mirror the server return types in queries.ts)
// ---------------------------------------------------------------------------
export interface DayPoint { day: string; value: number; }

export interface EngagementData {
    summary: {
        dau: number; wau: number; mau: number;
        stickiness_pct: number | null;
        questions_per_active_user: number | null;
        total_students: number;
        new_signups: number; prev_signups: number; growth_pct: number | null;
    };
    solvers: DayPoint[];
    signups: DayPoint[];
}

export interface ActivationData {
    summary: {
        signups: number; activated_48h: number;
        activation_pct: number | null; median_hours_to_first_solve: number | null;
    };
    cohorts: {
        cohort_week: string; size: number;
        d1: number; d7: number; d30: number;
        d1_pct: number | null; d7_pct: number | null; d30_pct: number | null;
        d7_elapsed: boolean; d30_elapsed: boolean;
    }[];
}

export interface StreaksData {
    summary: {
        on_streak_now: number; total_with_stats: number; on_streak_pct: number | null;
        avg_current_streak: number | null; best_streak: number;
        streak_7plus: number; streak_30plus: number;
    };
    distribution: { label: string; count: number }[];
}

export interface FeaturesData {
    potd: {
        potd_day: string | null; attempters: number; solvers: number; dau: number;
        participation_pct: number | null; solve_rate_pct: number | null;
    };
    customTest: {
        not_started: number; active: number; finished: number; total_tests: number;
        users_with_test: number; total_students: number; generating_pct: number | null;
    };
    contest: {
        entries: number; participants: number; missed: number;
        missed_pct: number | null; avg_accuracy_pct: number | null; contests: number;
    };
    doubt: { posts: number; comments: number; solved: number; solved_pct: number | null; posters: number };
    reach: {
        wau: number;
        potd: number; custom_test: number; contest: number; doubt: number;
        potd_pct: number | null; custom_test_pct: number | null; contest_pct: number | null; doubt_pct: number | null;
    };
}

export interface OutcomesData {
    summary: {
        avg_accuracy_pct: number | null;
        easy_solved: number; medium_solved: number; hard_solved: number;
        total_solved: number; pyq_solved: number; non_pyq_solved: number;
        total_attempts: number;
        users_with_weak_topics: number; avg_weakness_score: number | null;
    };
    bySubject: { label: string; count: number }[];
    byExam: { label: string; count: number }[];
    trend: { day: string; solved: number; cumulative: number }[];
}

export interface MonetizationData {
    summary: {
        free: number; premium: number; premium_pct: number | null;
        notif_total: number; notif_read: number; notif_read_pct: number | null;
        push_reachable_users: number; total_students: number; push_reach_pct: number | null;
        app_users: number; web_users: number; platform_users: number;
        app_pct: number | null; web_pct: number | null;
        lost_reachability: number; lapsed_14d: number;
    };
}

export interface ActiveUsersData {
    leaderboard: {
        user_id: string; name: string | null;
        exams: string[]; class_name: string | null;
        time_solving_sec: number; solved: number; attempts: number; active_days: number;
        solved_physics: number; solved_chemistry: number; solved_biology: number; solved_maths: number;
    }[];
    perDay: {
        day: string; user_id: string | null; name: string | null;
        exams: string[]; class_name: string | null;
        time_solving_sec: number; solved: number;
    }[];
}

/**
 * Aggregate time-on-task. Summed from `question_attempts.time_taken` (clamped
 * per attempt), so it counts time spent SOLVING across all of a student's
 * devices — not total app screentime (no such signal exists in the data).
 * `testHours` is a subset of `totalHours`, shown for context, never added.
 */
export interface TimeSpentData {
    summary: {
        totalHours: number;
        activeStudents: number;
        avgMinsPerStudent: number;
        medianMinsPerStudent: number;
        avgMinsPerActiveDay: number;
        testHours: number;
    };
    /** Per-IST-day series powering the daily / cumulative chart. */
    series: {
        day: string;
        hours: number;
        solved: number;
        students: number;
        cumStudents: number; // distinct students seen up to this day (never double-counts)
    }[];
}

export interface ClassesData { classes: { id: string; name: string }[]; }

export const SUBSCRIPTION_OPTIONS = [
    { label: "Free", value: "FREE" },
    { label: "Premium", value: "PREMIUM" },
];

export { EXAM_TYPE_OPTIONS };
