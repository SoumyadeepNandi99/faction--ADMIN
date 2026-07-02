import "server-only";
import { readonlyQuery, readonlyQueryOne } from "@/lib/db";
import { AnalyticsFilters, IST_SHIFT, dayRangePredicate, userScope } from "./filters";

/**
 * Founder-analytics SQL, grouped by dashboard section. Every function is a
 * read-only aggregate over faction-backend Postgres. All day-bucketing shifts
 * UTC → IST (`+ 330 minutes`) so numbers line up with POTD's calendar, exactly
 * as the reference SQL specifies. Segmentation (class/exam/subscription) is
 * applied by joining `users u` and AND-ing `userScope`; the date range is
 * applied to whichever timestamp is the metric's natural "when".
 *
 * A note on attribution: `question_attempts` has no `source` column, so
 * feature-level attempts (POTD/arena/in-test) are attributed by joining the
 * attempt's `question_id` + IST day to the feature's own table (see POTD).
 */

// Only STUDENT rows count as "users" for product metrics; ADMINs are staff.
const STUDENTS = `u.role = 'STUDENT'`;

// A reusable "today in IST" expression.
const IST_TODAY = `((now() + ${IST_SHIFT})::date)`;

// ===========================================================================
// 1. NORTH STAR & ENGAGEMENT
// ===========================================================================

export interface ActiveSummary {
    dau: number;
    wau: number;
    mau: number;
    stickiness_pct: number | null;
    questions_per_active_user: number | null;
    total_students: number;
    new_signups: number; // within the selected range (or all-time)
    prev_signups: number; // the equally-sized window immediately before
    growth_pct: number | null;
}

/**
 * DAU/WAU/MAU are anchored to the *end* of the selected range (or today).
 * "questions per active user per day" comes from user_daily_streaks, averaged
 * over the days in range. new_signups + growth compare the range to the window
 * immediately preceding it.
 */
export async function getActiveSummary(f: AnalyticsFilters): Promise<ActiveSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    // The activity anchor: the range's `to`, else today (IST).
    const anchor = f.to ? `$${scope.params.length + 1}::date` : IST_TODAY;
    const anchorParams = f.to ? [f.to] : [];

    const row = await readonlyQueryOne<{
        dau: string; wau: string; mau: string;
        total_students: string;
        qpau: string | null;
        new_signups: string; prev_signups: string;
        range_days: string | null;
    }>(
        `
        WITH att AS (
          SELECT a.user_id, (a.attempted_at + ${IST_SHIFT})::date AS d
          FROM question_attempts a
          JOIN users u ON u.id = a.user_id
          WHERE ${STUDENTS} ${scopeAnd}
        ),
        anchor AS (SELECT ${anchor} AS ad),
        signups AS (
          SELECT u.id, (u.created_at + ${IST_SHIFT})::date AS sd
          FROM users u WHERE ${STUDENTS} ${scopeAnd}
        ),
        range AS (
          SELECT
            ${f.from ? `$${scope.params.length + anchorParams.length + 1}::date` : `(SELECT min(sd) FROM signups)`} AS rf,
            (SELECT ad FROM anchor) AS rt
        )
        SELECT
          (SELECT count(DISTINCT user_id) FROM att, anchor WHERE d = ad) AS dau,
          (SELECT count(DISTINCT user_id) FROM att, anchor WHERE d > ad - 7 AND d <= ad) AS wau,
          (SELECT count(DISTINCT user_id) FROM att, anchor WHERE d > ad - 30 AND d <= ad) AS mau,
          (SELECT count(*) FROM signups) AS total_students,
          (SELECT round(avg(problems_solved), 2)
             FROM user_daily_streaks uds
             JOIN users u ON u.id = uds.user_id, range
            WHERE ${STUDENTS} ${scopeAnd}
              AND uds.problems_solved > 0
              AND uds.streak_date >= range.rf AND uds.streak_date <= range.rt) AS qpau,
          (SELECT count(*) FROM signups, range WHERE sd >= range.rf AND sd <= range.rt) AS new_signups,
          (SELECT count(*) FROM signups, range
             WHERE sd < range.rf
               AND sd >= range.rf - (range.rt - range.rf + 1)) AS prev_signups,
          (SELECT (range.rt - range.rf + 1) FROM range) AS range_days
        `,
        [...scope.params, ...anchorParams, ...(f.from ? [f.from] : [])],
    );

    const dau = num(row?.dau), wau = num(row?.wau), mau = num(row?.mau);
    const newS = num(row?.new_signups), prevS = num(row?.prev_signups);
    return {
        dau, wau, mau,
        stickiness_pct: mau > 0 ? round1((100 * dau) / mau) : null,
        questions_per_active_user: row?.qpau != null ? Number(row.qpau) : null,
        total_students: num(row?.total_students),
        new_signups: newS,
        prev_signups: prevS,
        growth_pct: prevS > 0 ? round1((100 * (newS - prevS)) / prevS) : null,
    };
}

export interface DayPoint { day: string; value: number; }

/** Daily Active Solvers time series (IST), within range. */
export async function getActiveSolversSeries(f: AnalyticsFilters): Promise<DayPoint[]> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const dayExpr = `(a.attempted_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(dayExpr, f, scope.params.length + 1);
    const rangeAnd = range.sql ? `AND ${range.sql}` : "";
    const rows = await readonlyQuery<{ day: string; value: string }>(
        `SELECT ${dayExpr} AS day, count(DISTINCT a.user_id) AS value
         FROM question_attempts a JOIN users u ON u.id = a.user_id
         WHERE ${STUDENTS} ${scopeAnd} ${rangeAnd}
         GROUP BY 1 ORDER BY 1`,
        [...scope.params, ...range.params],
    );
    return rows.map(r => ({ day: r.day, value: num(r.value) }));
}

/** New signups per IST day, within range. */
export async function getSignupSeries(f: AnalyticsFilters): Promise<DayPoint[]> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const dayExpr = `(u.created_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(dayExpr, f, scope.params.length + 1);
    const rangeAnd = range.sql ? `AND ${range.sql}` : "";
    const rows = await readonlyQuery<{ day: string; value: string }>(
        `SELECT ${dayExpr} AS day, count(*) AS value
         FROM users u
         WHERE ${STUDENTS} ${scopeAnd} ${rangeAnd}
         GROUP BY 1 ORDER BY 1`,
        [...scope.params, ...range.params],
    );
    return rows.map(r => ({ day: r.day, value: num(r.value) }));
}

// ===========================================================================
// 2. ACTIVATION & RETENTION
// ===========================================================================

export interface ActivationSummary {
    signups: number;
    activated_48h: number;
    activation_pct: number | null;
    median_hours_to_first_solve: number | null;
}

export async function getActivationSummary(f: AnalyticsFilters): Promise<ActivationSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const signupDay = `(u.created_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(signupDay, f, scope.params.length + 1);
    const rangeAnd = range.sql ? `AND ${range.sql}` : "";
    const row = await readonlyQueryOne<{
        signups: string; activated: string; activation_pct: string | null; median_hours: string | null;
    }>(
        `WITH firsts AS (
           SELECT u.id, u.created_at, MIN(a.attempted_at) AS first_solve
           FROM users u
           LEFT JOIN question_attempts a ON a.user_id = u.id
           WHERE ${STUDENTS} ${scopeAnd} ${rangeAnd}
           GROUP BY u.id, u.created_at
         )
         SELECT
           count(*) AS signups,
           count(*) FILTER (WHERE first_solve IS NOT NULL AND first_solve <= created_at + interval '48 hours') AS activated,
           round(100.0 * count(*) FILTER (WHERE first_solve IS NOT NULL AND first_solve <= created_at + interval '48 hours') / NULLIF(count(*),0), 1) AS activation_pct,
           round((percentile_cont(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (first_solve - created_at)) / 3600.0
           ) FILTER (WHERE first_solve IS NOT NULL))::numeric, 2) AS median_hours
         FROM firsts`,
        [...scope.params, ...range.params],
    );
    return {
        signups: num(row?.signups),
        activated_48h: num(row?.activated),
        activation_pct: row?.activation_pct != null ? Number(row.activation_pct) : null,
        median_hours_to_first_solve: row?.median_hours != null ? Number(row.median_hours) : null,
    };
}

export interface CohortRow {
    cohort_week: string;
    size: number;
    d1: number; d7: number; d30: number;
    d1_pct: number | null; d7_pct: number | null; d30_pct: number | null;
    d7_elapsed: boolean; d30_elapsed: boolean; // whether enough time has passed to judge
}

export async function getRetentionCohorts(f: AnalyticsFilters): Promise<CohortRow[]> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const rows = await readonlyQuery<{
        cohort_week: string; size: string; d1: string; d7: string; d30: string;
        d7_elapsed: boolean; d30_elapsed: boolean;
    }>(
        `WITH cohort AS (
           SELECT u.id, ((u.created_at + ${IST_SHIFT})::date) AS signup
           FROM users u WHERE ${STUDENTS} ${scopeAnd}
         ),
         act AS (
           SELECT DISTINCT a.user_id, ((a.attempted_at + ${IST_SHIFT})::date) AS d
           FROM question_attempts a
         )
         SELECT date_trunc('week', signup)::date AS cohort_week,
           count(DISTINCT c.id) AS size,
           count(DISTINCT c.id) FILTER (WHERE a.d = c.signup + 1) AS d1,
           count(DISTINCT c.id) FILTER (WHERE a.d = c.signup + 7) AS d7,
           count(DISTINCT c.id) FILTER (WHERE a.d = c.signup + 30) AS d30,
           bool_or(c.signup + 7 <= ${IST_TODAY}) AS d7_elapsed,
           bool_or(c.signup + 30 <= ${IST_TODAY}) AS d30_elapsed
         FROM cohort c LEFT JOIN act a ON a.user_id = c.id
         GROUP BY 1 ORDER BY 1`,
        scope.params,
    );
    return rows.map(r => {
        const size = num(r.size);
        const pct = (v: string) => (size > 0 ? round1((100 * num(v)) / size) : null);
        return {
            cohort_week: r.cohort_week,
            size,
            d1: num(r.d1), d7: num(r.d7), d30: num(r.d30),
            d1_pct: pct(r.d1), d7_pct: pct(r.d7), d30_pct: pct(r.d30),
            d7_elapsed: r.d7_elapsed, d30_elapsed: r.d30_elapsed,
        };
    });
}

// ===========================================================================
// 3. HABIT & STREAKS
// ===========================================================================

export interface StreakSummary {
    on_streak_now: number;
    total_with_stats: number;
    on_streak_pct: number | null;
    avg_current_streak: number | null;
    best_streak: number;
    streak_7plus: number;
    streak_30plus: number;
}

export async function getStreakSummary(f: AnalyticsFilters): Promise<StreakSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const row = await readonlyQueryOne<{
        on_streak: string; total: string; avg_streak: string | null; best: string;
        s7: string; s30: string;
    }>(
        `SELECT
           count(*) FILTER (WHERE s.current_study_streak >= 1
             AND s.last_study_date >= ${IST_TODAY} - 1) AS on_streak,
           count(*) AS total,
           round(avg(s.current_study_streak), 2) AS avg_streak,
           coalesce(max(s.longest_study_streak), 0) AS best,
           count(*) FILTER (WHERE s.current_study_streak >= 7) AS s7,
           count(*) FILTER (WHERE s.current_study_streak >= 30) AS s30
         FROM user_study_stats s
         JOIN users u ON u.id = s.user_id
         WHERE ${STUDENTS} ${scopeAnd}`,
        scope.params,
    );
    const onStreak = num(row?.on_streak), total = num(row?.total);
    return {
        on_streak_now: onStreak,
        total_with_stats: total,
        on_streak_pct: total > 0 ? round1((100 * onStreak) / total) : null,
        avg_current_streak: row?.avg_streak != null ? Number(row.avg_streak) : null,
        best_streak: num(row?.best),
        streak_7plus: num(row?.s7),
        streak_30plus: num(row?.s30),
    };
}

export interface Bucket { label: string; count: number; }

export async function getStreakDistribution(f: AnalyticsFilters): Promise<Bucket[]> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const rows = await readonlyQuery<{ label: string; count: string; ord: string }>(
        `SELECT bucket AS label, count(*) AS count, min(ord) AS ord FROM (
           SELECT CASE
             WHEN s.current_study_streak = 0 THEN '0'
             WHEN s.current_study_streak BETWEEN 1 AND 2 THEN '1–2'
             WHEN s.current_study_streak BETWEEN 3 AND 6 THEN '3–6'
             WHEN s.current_study_streak BETWEEN 7 AND 14 THEN '7–14'
             WHEN s.current_study_streak BETWEEN 15 AND 30 THEN '15–30'
             ELSE '30+' END AS bucket,
             CASE
             WHEN s.current_study_streak = 0 THEN 0
             WHEN s.current_study_streak BETWEEN 1 AND 2 THEN 1
             WHEN s.current_study_streak BETWEEN 3 AND 6 THEN 2
             WHEN s.current_study_streak BETWEEN 7 AND 14 THEN 3
             WHEN s.current_study_streak BETWEEN 15 AND 30 THEN 4
             ELSE 5 END AS ord
           FROM user_study_stats s JOIN users u ON u.id = s.user_id
           WHERE ${STUDENTS} ${scopeAnd}
         ) t GROUP BY bucket ORDER BY ord`,
        scope.params,
    );
    return rows.map(r => ({ label: r.label, count: num(r.count) }));
}

// ===========================================================================
// 4. FEATURE USAGE
// ===========================================================================

export interface PotdSummary {
    potd_day: string | null;
    attempters: number;
    solvers: number;
    dau: number;
    participation_pct: number | null;
    solve_rate_pct: number | null;
}

/** POTD participation & solve rate for the most recent scheduled POTD ≤ today. */
export async function getPotdSummary(f: AnalyticsFilters): Promise<PotdSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const row = await readonlyQueryOne<{
        potd_day: string | null; attempters: string; solvers: string; dau: string;
    }>(
        `WITH latest AS (
           SELECT scheduled_date, question_ids FROM potd_schedule
           WHERE scheduled_date <= ${IST_TODAY}
           ORDER BY scheduled_date DESC LIMIT 1
         ),
         todays_potd AS (SELECT scheduled_date AS d, unnest(question_ids)::uuid AS qid FROM latest),
         potd_attempts AS (
           SELECT a.user_id, bool_or(a.is_correct) AS solved
           FROM question_attempts a
           JOIN users u ON u.id = a.user_id
           JOIN todays_potd p ON p.qid = a.question_id
             AND (a.attempted_at + ${IST_SHIFT})::date = p.d
           WHERE ${STUDENTS} ${scopeAnd}
           GROUP BY a.user_id
         ),
         dau AS (
           SELECT count(DISTINCT a.user_id) AS n
           FROM question_attempts a JOIN users u ON u.id = a.user_id
           WHERE ${STUDENTS} ${scopeAnd}
             AND (a.attempted_at + ${IST_SHIFT})::date = (SELECT scheduled_date FROM latest)
         )
         SELECT (SELECT scheduled_date FROM latest) AS potd_day,
           count(*) AS attempters,
           count(*) FILTER (WHERE solved) AS solvers,
           (SELECT n FROM dau) AS dau
         FROM potd_attempts`,
        scope.params,
    );
    const attempters = num(row?.attempters), solvers = num(row?.solvers), dau = num(row?.dau);
    return {
        potd_day: row?.potd_day ?? null,
        attempters, solvers, dau,
        participation_pct: dau > 0 ? round1((100 * attempters) / dau) : null,
        solve_rate_pct: attempters > 0 ? round1((100 * solvers) / attempters) : null,
    };
}

export interface CustomTestFunnel {
    not_started: number;
    active: number;
    finished: number;
    total_tests: number;
    users_with_test: number;
    total_students: number;
    generating_pct: number | null;
}

export async function getCustomTestFunnel(f: AnalyticsFilters): Promise<CustomTestFunnel> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const testDay = `(ct.created_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(testDay, f, scope.params.length + 1);
    const rangeWhere = range.sql ? `WHERE ${range.sql}` : "";
    const row = await readonlyQueryOne<{
        not_started: string; active: string; finished: string; total: string;
        users_with_test: string; total_students: string;
    }>(
        `WITH scoped_students AS (
           SELECT u.id FROM users u WHERE ${STUDENTS} ${scopeAnd}
         ),
         ct AS (
           SELECT ct.* FROM customtest ct
           JOIN scoped_students s ON s.id = ct.user_id
           ${rangeWhere}
         )
         SELECT
           count(*) FILTER (WHERE status = 'not_started') AS not_started,
           count(*) FILTER (WHERE status = 'active') AS active,
           count(*) FILTER (WHERE status = 'finished') AS finished,
           count(*) AS total,
           count(DISTINCT user_id) AS users_with_test,
           (SELECT count(*) FROM scoped_students) AS total_students
         FROM ct`,
        [...scope.params, ...range.params],
    );
    const usersWith = num(row?.users_with_test), totalStudents = num(row?.total_students);
    return {
        not_started: num(row?.not_started),
        active: num(row?.active),
        finished: num(row?.finished),
        total_tests: num(row?.total),
        users_with_test: usersWith,
        total_students: totalStudents,
        generating_pct: totalStudents > 0 ? round1((100 * usersWith) / totalStudents) : null,
    };
}

export interface ContestSummary {
    entries: number;
    participants: number;
    missed: number;
    missed_pct: number | null;
    avg_accuracy_pct: number | null;
    contests: number;
}

export async function getContestSummary(f: AnalyticsFilters): Promise<ContestSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const row = await readonlyQueryOne<{
        entries: string; participants: string; missed: string; avg_acc: string | null; contests: string;
    }>(
        `SELECT
           count(*) AS entries,
           count(DISTINCT cl.user_id) AS participants,
           count(*) FILTER (WHERE cl.missed) AS missed,
           -- contestleaderboard.accuracy is already stored as a 0–100 percentage.
           round((avg(cl.accuracy) FILTER (WHERE NOT cl.missed))::numeric, 1) AS avg_acc,
           count(DISTINCT cl.contest_id) AS contests
         FROM contestleaderboard cl
         JOIN users u ON u.id = cl.user_id
         WHERE ${STUDENTS} ${scopeAnd}`,
        scope.params,
    );
    const entries = num(row?.entries), missed = num(row?.missed);
    return {
        entries,
        participants: num(row?.participants),
        missed,
        missed_pct: entries > 0 ? round1((100 * missed) / entries) : null,
        avg_accuracy_pct: row?.avg_acc != null ? Number(row.avg_acc) : null,
        contests: num(row?.contests),
    };
}

export interface DoubtSummary {
    posts: number;
    comments: number;
    solved: number;
    solved_pct: number | null;
    posters: number;
}

export async function getDoubtSummary(f: AnalyticsFilters): Promise<DoubtSummary> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const postDay = `(dp.created_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(postDay, f, scope.params.length + 1);
    const rangeAnd = range.sql ? `AND ${range.sql}` : "";
    const row = await readonlyQueryOne<{
        posts: string; solved: string; posters: string;
    }>(
        `SELECT
           count(*) AS posts,
           count(*) FILTER (WHERE dp.is_solved) AS solved,
           count(DISTINCT dp.user_id) AS posters
         FROM doubt_posts dp JOIN users u ON u.id = dp.user_id
         WHERE ${STUDENTS} ${scopeAnd} ${rangeAnd}`,
        [...scope.params, ...range.params],
    );
    // Comments counted separately (own timestamp).
    const cScope = userScope(f, 1);
    const cScopeAnd = cScope.sql ? `AND ${cScope.sql}` : "";
    const cDay = `(dc.created_at + ${IST_SHIFT})::date`;
    const cRange = dayRangePredicate(cDay, f, cScope.params.length + 1);
    const cRangeAnd = cRange.sql ? `AND ${cRange.sql}` : "";
    const crow = await readonlyQueryOne<{ comments: string }>(
        `SELECT count(*) AS comments
         FROM doubt_comments dc JOIN users u ON u.id = dc.user_id
         WHERE ${STUDENTS} ${cScopeAnd} ${cRangeAnd}`,
        [...cScope.params, ...cRange.params],
    );
    const posts = num(row?.posts), solved = num(row?.solved);
    return {
        posts,
        comments: num(crow?.comments),
        solved,
        solved_pct: posts > 0 ? round1((100 * solved) / posts) : null,
        posters: num(row?.posters),
    };
}

export interface FeatureReach {
    wau: number;
    potd: number; custom_test: number; contest: number; doubt: number;
    potd_pct: number | null; custom_test_pct: number | null; contest_pct: number | null; doubt_pct: number | null;
}

/** % of WAU (last 7 IST days, anchored to range `to`/today) touching each feature. */
export async function getFeatureReach(f: AnalyticsFilters): Promise<FeatureReach> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const anchor = f.to ? `$${scope.params.length + 1}::date` : IST_TODAY;
    const anchorParams = f.to ? [f.to] : [];
    const row = await readonlyQueryOne<{
        wau: string; potd: string; ct: string; contest: string; doubt: string;
    }>(
        `WITH anchor AS (SELECT ${anchor} AS d),
         wau AS (
           SELECT DISTINCT a.user_id FROM question_attempts a
           JOIN users u ON u.id = a.user_id, anchor
           WHERE ${STUDENTS} ${scopeAnd}
             AND (a.attempted_at + ${IST_SHIFT})::date > anchor.d - 7
             AND (a.attempted_at + ${IST_SHIFT})::date <= anchor.d
         ),
         potd_q AS (
           SELECT unnest(question_ids)::uuid AS qid, scheduled_date
           FROM potd_schedule, anchor
           WHERE scheduled_date > anchor.d - 7 AND scheduled_date <= anchor.d
         ),
         potd_users AS (
           SELECT DISTINCT a.user_id FROM question_attempts a
           JOIN potd_q p ON p.qid = a.question_id
             AND (a.attempted_at + ${IST_SHIFT})::date = p.scheduled_date
         ),
         ct_users AS (
           SELECT DISTINCT user_id FROM customtest, anchor
           WHERE (created_at + ${IST_SHIFT})::date > anchor.d - 7
             AND (created_at + ${IST_SHIFT})::date <= anchor.d
         ),
         contest_users AS (
           SELECT DISTINCT user_id FROM contestleaderboard, anchor
           WHERE (created_at + ${IST_SHIFT})::date > anchor.d - 7
             AND (created_at + ${IST_SHIFT})::date <= anchor.d
         ),
         doubt_users AS (
           SELECT user_id FROM doubt_posts, anchor
             WHERE (created_at + ${IST_SHIFT})::date > anchor.d - 7 AND (created_at + ${IST_SHIFT})::date <= anchor.d
           UNION
           SELECT user_id FROM doubt_comments, anchor
             WHERE (created_at + ${IST_SHIFT})::date > anchor.d - 7 AND (created_at + ${IST_SHIFT})::date <= anchor.d
         )
         SELECT
           (SELECT count(*) FROM wau) AS wau,
           (SELECT count(*) FROM wau w WHERE w.user_id IN (SELECT user_id FROM potd_users)) AS potd,
           (SELECT count(*) FROM wau w WHERE w.user_id IN (SELECT user_id FROM ct_users)) AS ct,
           (SELECT count(*) FROM wau w WHERE w.user_id IN (SELECT user_id FROM contest_users)) AS contest,
           (SELECT count(*) FROM wau w WHERE w.user_id IN (SELECT user_id FROM doubt_users)) AS doubt`,
        [...scope.params, ...anchorParams],
    );
    const wau = num(row?.wau);
    const pct = (v?: string) => (wau > 0 ? round1((100 * num(v)) / wau) : null);
    return {
        wau,
        potd: num(row?.potd), custom_test: num(row?.ct), contest: num(row?.contest), doubt: num(row?.doubt),
        potd_pct: pct(row?.potd), custom_test_pct: pct(row?.ct), contest_pct: pct(row?.contest), doubt_pct: pct(row?.doubt),
    };
}

// ===========================================================================
// 5. LEARNING OUTCOMES
// ===========================================================================

export interface LearningOutcomes {
    avg_accuracy_pct: number | null;
    easy_solved: number; medium_solved: number; hard_solved: number;
    users_with_weak_topics: number;
    avg_weakness_score: number | null;
}

export async function getLearningOutcomes(f: AnalyticsFilters): Promise<LearningOutcomes> {
    const scope = userScope(f, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const row = await readonlyQueryOne<{
        avg_acc: string | null; easy: string; medium: string; hard: string;
    }>(
        `SELECT
           -- user_study_stats.accuracy_rate is already stored as a 0–100 percentage.
           round((avg(s.accuracy_rate) FILTER (WHERE s.total_attempts > 0))::numeric, 1) AS avg_acc,
           coalesce(sum(s.easy_solved), 0) AS easy,
           coalesce(sum(s.medium_solved), 0) AS medium,
           coalesce(sum(s.hard_solved), 0) AS hard
         FROM user_study_stats s JOIN users u ON u.id = s.user_id
         WHERE ${STUDENTS} ${scopeAnd}`,
        scope.params,
    );
    const wScope = userScope(f, 1);
    const wScopeAnd = wScope.sql ? `AND ${wScope.sql}` : "";
    const wrow = await readonlyQueryOne<{ users_weak: string; avg_weak: string | null }>(
        `SELECT count(DISTINCT w.user_id) AS users_weak,
                round(avg(w.weakness_score)::numeric, 2) AS avg_weak
         FROM user_weak_topics w JOIN users u ON u.id = w.user_id
         WHERE ${STUDENTS} ${wScopeAnd}`,
        wScope.params,
    );
    return {
        avg_accuracy_pct: row?.avg_acc != null ? Number(row.avg_acc) : null,
        easy_solved: num(row?.easy),
        medium_solved: num(row?.medium),
        hard_solved: num(row?.hard),
        users_with_weak_topics: num(wrow?.users_weak),
        avg_weakness_score: wrow?.avg_weak != null ? Number(wrow.avg_weak) : null,
    };
}

// ===========================================================================
// 6. MONETIZATION & NOTIFICATIONS
// ===========================================================================

export interface MonetizationSummary {
    free: number;
    premium: number;
    premium_pct: number | null;
    notif_total: number;
    notif_read: number;
    notif_read_pct: number | null;
    push_reachable_users: number;
    total_students: number;
    push_reach_pct: number | null;
}

export async function getMonetizationSummary(f: AnalyticsFilters): Promise<MonetizationSummary> {
    // Subscription mix ignores the subscriptionType filter (it *is* the split),
    // but honours class/exam/date-of-signup segmentation.
    const mixFilters: AnalyticsFilters = { ...f, subscriptionType: undefined };
    const scope = userScope(mixFilters, 1);
    const scopeAnd = scope.sql ? `AND ${scope.sql}` : "";
    const signupDay = `(u.created_at + ${IST_SHIFT})::date`;
    const range = dayRangePredicate(signupDay, mixFilters, scope.params.length + 1);
    const rangeAnd = range.sql ? `AND ${range.sql}` : "";
    const mix = await readonlyQueryOne<{ free: string; premium: string; total: string }>(
        `SELECT
           count(*) FILTER (WHERE u.subscription_type = 'FREE') AS free,
           count(*) FILTER (WHERE u.subscription_type = 'PREMIUM') AS premium,
           count(*) AS total
         FROM users u WHERE ${STUDENTS} ${scopeAnd} ${rangeAnd}`,
        [...scope.params, ...range.params],
    );

    // Notifications & push reachability honour the full segmentation.
    const nScope = userScope(f, 1);
    const nScopeAnd = nScope.sql ? `AND ${nScope.sql}` : "";
    const nDay = `(n.created_at + ${IST_SHIFT})::date`;
    const nRange = dayRangePredicate(nDay, f, nScope.params.length + 1);
    const nRangeAnd = nRange.sql ? `AND ${nRange.sql}` : "";
    const notif = await readonlyQueryOne<{ total: string; read: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE n.is_read) AS read
         FROM notifications n JOIN users u ON u.id = n.user_id
         WHERE ${STUDENTS} ${nScopeAnd} ${nRangeAnd}`,
        [...nScope.params, ...nRange.params],
    );

    const pScope = userScope(f, 1);
    const pScopeAnd = pScope.sql ? `AND ${pScope.sql}` : "";
    const push = await readonlyQueryOne<{ reachable: string; total_students: string }>(
        `WITH scoped AS (SELECT u.id FROM users u WHERE ${STUDENTS} ${pScopeAnd})
         SELECT
           (SELECT count(DISTINCT us.user_id) FROM user_sessions us
              JOIN scoped s ON s.id = us.user_id
             WHERE us.push_token IS NOT NULL AND us.push_token <> '') AS reachable,
           (SELECT count(*) FROM scoped) AS total_students`,
        pScope.params,
    );

    const free = num(mix?.free), premium = num(mix?.premium), total = num(mix?.total);
    const nTotal = num(notif?.total), nRead = num(notif?.read);
    const reachable = num(push?.reachable), totalStudents = num(push?.total_students);
    return {
        free, premium,
        premium_pct: total > 0 ? round1((100 * premium) / total) : null,
        notif_total: nTotal,
        notif_read: nRead,
        notif_read_pct: nTotal > 0 ? round1((100 * nRead) / nTotal) : null,
        push_reachable_users: reachable,
        total_students: totalStudents,
        push_reach_pct: totalStudents > 0 ? round1((100 * reachable) / totalStudents) : null,
    };
}

// ===========================================================================
// Filter option sources (classes) for the segmentation UI.
// ===========================================================================

export interface ClassOption { id: string; name: string; }

export async function getClasses(): Promise<ClassOption[]> {
    const rows = await readonlyQuery<{ id: string; name: string }>(
        `SELECT id, name FROM class ORDER BY name`,
    );
    return rows;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function num(v: string | number | null | undefined): number {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}
function round1(n: number): number {
    return Math.round(n * 10) / 10;
}
