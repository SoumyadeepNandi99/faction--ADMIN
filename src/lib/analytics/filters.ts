import "server-only";

/**
 * Server-side segmentation for the founder-analytics queries.
 *
 * Every metric can optionally be scoped by:
 *   - a date range (IST calendar days, "YYYY-MM-DD")
 *   - class_id
 *   - one or more target_exams (users.target_exams is JSON array)
 *   - subscription_type (FREE | PREMIUM)
 *
 * These are turned into a reusable `users`-scoped predicate. Callers that join
 * `users u` add `AND <predicate>` and append `params`. Values are always bound
 * as $N parameters — never interpolated — so segmentation can't inject SQL.
 */

export interface AnalyticsFilters {
    from?: string; // inclusive IST day
    to?: string; // inclusive IST day
    classId?: string;
    examTypes?: string[];
    subscriptionType?: string; // "FREE" | "PREMIUM"
}

// IST offset used for global "today"/day-bucketing, matching how POTD is
// scheduled and the reference SQL. (All users currently carry offset 330; this
// constant keeps the global buckets aligned with the app's calendar.)
export const IST_MINUTES = 330;
export const IST_SHIFT = `interval '${IST_MINUTES} minutes'`;

export interface UserScope {
    /** SQL fragment (may be empty) to AND onto a query that has `users u` in scope. */
    sql: string;
    /** Positional params, in order, to append after the caller's own params. */
    params: unknown[];
}

/**
 * Build a WHERE-fragment scoping to `users u`, given the filters and the index
 * of the next positional parameter (1-based). The date range is applied to the
 * caller-provided column expression separately (see `dayRangePredicate`),
 * because "which date" differs per metric (signup vs attempt vs test-created).
 */
export function userScope(f: AnalyticsFilters, startIndex: number): UserScope {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = startIndex;

    if (f.classId) {
        parts.push(`u.class_id = $${i++}`);
        params.push(f.classId);
    }
    if (f.subscriptionType) {
        parts.push(`u.subscription_type = $${i++}::subscriptiontype`);
        params.push(f.subscriptionType);
    }
    if (f.examTypes && f.examTypes.length) {
        // users.target_exams is a JSON array of exam strings. Cast to jsonb and
        // test overlap with the requested set: TRUE if the user targets ANY of
        // them. `?|` needs a text[] on the right.
        parts.push(`(u.target_exams)::jsonb ?| $${i++}::text[]`);
        params.push(f.examTypes);
    }
    return { sql: parts.length ? parts.join(" AND ") : "", params };
}

/**
 * A predicate bounding an IST-day expression to [from, to]. `dayExpr` must be a
 * SQL expression already evaluating to a `date` in IST (e.g.
 * `(a.attempted_at + interval '330 minutes')::date`). Returns "" if no range.
 */
export function dayRangePredicate(
    dayExpr: string,
    f: AnalyticsFilters,
    startIndex: number,
): { sql: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];
    let i = startIndex;
    if (f.from) {
        parts.push(`${dayExpr} >= $${i++}::date`);
        params.push(f.from);
    }
    if (f.to) {
        parts.push(`${dayExpr} <= $${i++}::date`);
        params.push(f.to);
    }
    return { sql: parts.length ? parts.join(" AND ") : "", params };
}
