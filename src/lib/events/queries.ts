import "server-only";
import { readonlyQuery } from "@/lib/db";

/**
 * Events — read-only leaderboard queries.
 *
 * Reads the same data the app's Faction Legends "Progress" surfaces: each
 * student's solved count from `user_study_stats` (the precomputed aggregate the
 * app fetches via GET /streaks/me/stats → study_activity_graph). We do NOT change
 * the app or backend — this only SELECTs, through the hardened read-only pool in
 * `@/lib/db`. `questions_solved` = easy+medium+hard the student has solved; the
 * per-subject columns come from the same `study_activity_graph` JSON the app sums.
 */

export interface EventLeaderRow {
    user_id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    class_name: string | null;
    exams: string[];
    current_rating: number | null;
    /** The headline metric: total questions solved (matches Legends "solved"). */
    questions_solved: number;
    total_attempts: number;
    accuracy_rate: number | null;
    current_streak: number;
    last_active: string | null; // YYYY-MM-DD (IST study date)
    solved_physics: number;
    solved_chemistry: number;
    solved_biology: number;
    solved_maths: number;
}

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** target_exams is a JSON array like ["NEET"] or ["JEE_MAINS","JEE_ADVANCED"]. */
function parseExams(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.map(String) : [];
    } catch {
        return [];
    }
}

/** Subject-scoped solve sum from study_activity_graph, per the given JSON key. */
const subjSum = (key: string) =>
    `COALESCE((s.study_activity_graph->'${key}'->>'easy')::int,0)
     + COALESCE((s.study_activity_graph->'${key}'->>'medium')::int,0)
     + COALESCE((s.study_activity_graph->'${key}'->>'hard')::int,0)`;

/**
 * World Cup / Legends leaderboard: active students ranked by questions solved.
 * Participants = active students who have solved at least one question (i.e. are
 * engaging with the season). Read-only; parameterised limit.
 */
export async function getEventLeaderboard(limit = 200): Promise<EventLeaderRow[]> {
    const rows = await readonlyQuery<{
        user_id: string; name: string | null; username: string | null; avatar_url: string | null;
        class_name: string | null; exams: string | null; current_rating: number | null;
        questions_solved: string; total_attempts: string; accuracy_rate: string | null;
        current_streak: string; last_active: string | null;
        physics: string; chemistry: string; biology: string; maths: string;
    }>(
        `SELECT u.id AS user_id,
             u.name AS name,
             u.username AS username,
             u.avatar_url AS avatar_url,
             cl.name AS class_name,
             (u.target_exams)::text AS exams,
             u.current_rating AS current_rating,
             s.questions_solved AS questions_solved,
             s.total_attempts AS total_attempts,
             s.accuracy_rate AS accuracy_rate,
             s.current_study_streak AS current_streak,
             s.last_study_date::text AS last_active,
             ${subjSum("Physics")} AS physics,
             ${subjSum("Chemistry")} AS chemistry,
             ${subjSum("Biology")} AS biology,
             ${subjSum("Mathematics")} AS maths
         FROM user_study_stats s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN class cl ON cl.id = u.class_id
         WHERE u.role = 'STUDENT' AND u.is_active = true AND s.questions_solved > 0
         ORDER BY s.questions_solved DESC, s.accuracy_rate DESC NULLS LAST
         LIMIT $1`,
        [limit],
    );

    return rows.map(r => ({
        user_id: r.user_id,
        name: r.name,
        username: r.username,
        avatar_url: r.avatar_url,
        class_name: r.class_name,
        exams: parseExams(r.exams),
        current_rating: r.current_rating != null ? num(r.current_rating) : null,
        questions_solved: num(r.questions_solved),
        total_attempts: num(r.total_attempts),
        accuracy_rate: r.accuracy_rate != null ? Number(r.accuracy_rate) : null,
        current_streak: num(r.current_streak),
        last_active: r.last_active,
        solved_physics: num(r.physics),
        solved_chemistry: num(r.chemistry),
        solved_biology: num(r.biology),
        solved_maths: num(r.maths),
    }));
}
