import "server-only";
import { readonlyQuery } from "@/lib/db";
import { IST_SHIFT } from "./filters";

/**
 * Audience segments for targeted broadcasts. Each segment is a read-only SQL
 * query that returns a list of STUDENT user IDs; the broadcast composer feeds
 * those IDs into the EXISTING `POST /notifications/admin/send` endpoint (the same
 * one "specific users" already uses). No new backend route, no writes — just a
 * smarter recipient list.
 *
 * All day math is IST (+330 min) to line up with POTD scheduling. "Today" and
 * "yesterday" are IST calendar days on the server clock.
 */

export type SegmentKey =
    | "potd_not_completed"
    | "potd_not_attempted"
    | "no_session_yesterday"
    | "no_solve_yesterday"
    | "inactive_7d";

export interface SegmentDef {
    key: SegmentKey;
    label: string;
    description: string;
}

// Presentation metadata (also surfaced to the client so labels live in one place).
export const SEGMENTS: SegmentDef[] = [
    {
        key: "potd_not_completed",
        label: "Didn't complete today's POTD",
        description: "Students who have not correctly solved today's Problem of the Day.",
    },
    {
        key: "potd_not_attempted",
        label: "Didn't attempt today's POTD",
        description: "Students who haven't even opened today's Problem of the Day.",
    },
    {
        key: "no_session_yesterday",
        label: "Didn't log in yesterday",
        description: "Students with no app session (last_active) on yesterday's IST day.",
    },
    {
        key: "no_solve_yesterday",
        label: "Didn't practice yesterday",
        description: "Students who solved no questions yesterday.",
    },
    {
        key: "inactive_7d",
        label: "Inactive for 7 days",
        description: "Students with no question attempts in the last 7 days.",
    },
];

export function isSegmentKey(v: string): v is SegmentKey {
    return SEGMENTS.some(s => s.key === v);
}

const STUDENTS = `u.role = 'STUDENT'`;
const IST_TODAY = `((now() + ${IST_SHIFT})::date)`;

/**
 * Return the STUDENT user IDs in a segment. Every segment is expressed as
 * "all students EXCEPT those who did <engaged action>", so an empty engaged set
 * correctly yields all students (not an empty list).
 */
export async function getSegmentUserIds(segment: SegmentKey): Promise<string[]> {
    const sql = SEGMENT_SQL[segment];
    const rows = await readonlyQuery<{ id: string }>(sql);
    return rows.map(r => r.id);
}

// Each query selects student ids NOT IN an "engaged" subquery. Written as static
// SQL (no user input interpolated) — `segment` is validated to a known key
// before we ever get here.
const SEGMENT_SQL: Record<SegmentKey, string> = {
    // Latest POTD scheduled on-or-before today; students without a CORRECT solve of it that day.
    potd_not_completed: `
        WITH latest_potd AS (
          SELECT scheduled_date, question_ids FROM potd_schedule
          WHERE scheduled_date <= ${IST_TODAY} ORDER BY scheduled_date DESC LIMIT 1
        ),
        potd_q AS (SELECT scheduled_date AS pd, unnest(question_ids)::uuid AS qid FROM latest_potd),
        engaged AS (
          SELECT DISTINCT a.user_id FROM question_attempts a
          JOIN potd_q p ON p.qid = a.question_id
          WHERE a.is_correct AND (a.attempted_at + ${IST_SHIFT})::date = p.pd
        )
        SELECT u.id FROM users u
        WHERE ${STUDENTS} AND u.id NOT IN (SELECT user_id FROM engaged)`,

    // Same, but "engaged" = attempted at all (correct or not).
    potd_not_attempted: `
        WITH latest_potd AS (
          SELECT scheduled_date, question_ids FROM potd_schedule
          WHERE scheduled_date <= ${IST_TODAY} ORDER BY scheduled_date DESC LIMIT 1
        ),
        potd_q AS (SELECT scheduled_date AS pd, unnest(question_ids)::uuid AS qid FROM latest_potd),
        engaged AS (
          SELECT DISTINCT a.user_id FROM question_attempts a
          JOIN potd_q p ON p.qid = a.question_id
          WHERE (a.attempted_at + ${IST_SHIFT})::date = p.pd
        )
        SELECT u.id FROM users u
        WHERE ${STUDENTS} AND u.id NOT IN (SELECT user_id FROM engaged)`,

    // No app session (last_active) on yesterday's IST day.
    no_session_yesterday: `
        WITH engaged AS (
          SELECT DISTINCT user_id FROM user_sessions
          WHERE (last_active + ${IST_SHIFT})::date = ${IST_TODAY} - 1
        )
        SELECT u.id FROM users u
        WHERE ${STUDENTS} AND u.id NOT IN (SELECT user_id FROM engaged)`,

    // No question attempt yesterday.
    no_solve_yesterday: `
        WITH engaged AS (
          SELECT DISTINCT user_id FROM question_attempts
          WHERE (attempted_at + ${IST_SHIFT})::date = ${IST_TODAY} - 1
        )
        SELECT u.id FROM users u
        WHERE ${STUDENTS} AND u.id NOT IN (SELECT user_id FROM engaged)`,

    // No question attempt in the last 7 IST days (including today).
    inactive_7d: `
        WITH engaged AS (
          SELECT DISTINCT user_id FROM question_attempts
          WHERE (attempted_at + ${IST_SHIFT})::date > ${IST_TODAY} - 7
        )
        SELECT u.id FROM users u
        WHERE ${STUDENTS} AND u.id NOT IN (SELECT user_id FROM engaged)`,
};
