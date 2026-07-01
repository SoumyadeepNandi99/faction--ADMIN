import { apiClient } from "@/lib/axios";

export type ContestStatus = "active" | "finished" | "not_started";
export type ExamType = "JEE_MAINS" | "JEE_ADVANCED" | "NEET" | "OLYMPIAD" | "CBSE" | "BOARDS";

export interface Contest {
    id: string;
    name: string;
    description?: string | null;
    class_id: string;
    total_time: number; // seconds
    status: ContestStatus;
    starts_at: string;
    ends_at: string; // computed server-side from starts_at + total_time
    exam_type: ExamType;
    created_at: string;
    has_attempted?: boolean;
}

export interface ContestCreatePayload {
    name: string;
    description?: string | null;
    class_id: string;
    question_ids: string[];
    total_time: number; // seconds
    status: ContestStatus;
    starts_at: string; // ISO datetime
    exam_type: ExamType;
}

export const getContests = (type: "upcoming" | "past") =>
    apiClient.get(`/api/v1/contests/?type=${type}`).then(r => {
        const d = r.data;
        return (Array.isArray(d) ? d : d.contests || []) as Contest[];
    });

export const createContest = (payload: ContestCreatePayload) =>
    apiClient.post<Contest>("/api/v1/contests/", payload).then(r => r.data);

// --- Question pool for contest selection (hidden questions only) ---
export interface PoolQuestion {
    id: string;
    topic_id: string;
    type: string;
    difficulty: number;
    exam_type: ExamType[];
    question_text: string;
    marks: number;
    question_image?: string | null;
    hidden: boolean;
}

export interface QuestionPage {
    questions: PoolQuestion[];
    total: number;
    skip: number;
    limit: number;
}

/** Fetch hidden (contest-eligible) questions, optionally filtered by subject. */
export const getContestQuestionPool = (params: {
    subject_id?: string;
    chapter_id?: string;
    difficulty?: number;
    skip?: number;
    limit?: number;
}) =>
    apiClient
        .get<QuestionPage>("/api/v1/questions/", {
            params: { ...params, hidden: true },
        })
        .then(r => r.data);

// --- PYQ tagging (client-side derivation) ---
// The hidden-question pool response has no PYQ flag, so we derive it: fetch every
// previous_year_problems row once and build a Set of PYQ-tagged question IDs. The
// contest builder uses it to badge (and optionally hide) PYQ questions in the pool.

interface PyqLite {
    question_id: string;
    year: number;
    exam_detail: string[];
}

/** Details of a question's PYQ tag, keyed by question_id (for the pool badge tooltip). */
export interface PyqInfo {
    year: number;
    exam_detail: string[];
}

/**
 * Build a map of every PYQ-tagged question_id -> its PYQ details.
 *
 * The `GET /pyq/` list endpoint reports `total: 0` in its no-exam branch, so we
 * can't page by total — instead we walk pages until one comes back short. Bounded
 * by MAX_PAGES so a backend that never returns a short page can't loop forever.
 * Purely client-side — no backend change required.
 */
export const getPyqQuestionMap = async (): Promise<Map<string, PyqInfo>> => {
    const LIMIT = 100;
    const MAX_PAGES = 200; // safety cap: up to 20k PYQs
    const map = new Map<string, PyqInfo>();

    for (let page = 0; page < MAX_PAGES; page++) {
        let rows: PyqLite[];
        try {
            const { data } = await apiClient.get<{ pyqs?: PyqLite[] }>("/api/v1/pyq/", {
                params: { skip: page * LIMIT, limit: LIMIT },
            });
            rows = data?.pyqs ?? [];
        } catch {
            break; // on error, return whatever we have so the picker still works
        }
        for (const r of rows) {
            if (r.question_id) map.set(r.question_id, { year: r.year, exam_detail: r.exam_detail });
        }
        if (rows.length < LIMIT) break; // short page => last page
    }
    return map;
};

// --- Topic -> chapter mapping (client-side derivation) ---
// The pool response carries topic_id but not the chapter. We fetch the subject's
// chapters and their topics to map each question's topic_id to a chapter, so the
// builder can label questions by chapter and offer a chapter filter.

interface ChapterLite { id: string; name: string; }
interface TopicLite { id: string; chapter_id: string; }

export interface ChapterRef { chapterId: string; chapterName: string; }

/**
 * For a subject, return { chapters, topicToChapter } where `chapters` is the
 * subject's chapter list (for the filter dropdown) and `topicToChapter` maps each
 * topic_id to its chapter. Topic lists are fetched per chapter and in parallel.
 */
export const getSubjectChapterMap = async (
    subjectId: string,
): Promise<{ chapters: ChapterRef[]; topicToChapter: Map<string, ChapterRef> }> => {
    const { data: chapterData } = await apiClient.get<{ chapters?: ChapterLite[] }>(
        "/api/v1/chapters/",
        { params: { subject_id: subjectId } },
    );
    const chapterList = chapterData?.chapters ?? [];
    const chapters: ChapterRef[] = chapterList.map(c => ({ chapterId: c.id, chapterName: c.name }));

    const topicToChapter = new Map<string, ChapterRef>();
    await Promise.all(
        chapters.map(async ch => {
            try {
                const { data } = await apiClient.get<{ topics?: TopicLite[] }>("/api/v1/topics/", {
                    params: { chapter_id: ch.chapterId },
                });
                for (const t of data?.topics ?? []) topicToChapter.set(t.id, ch);
            } catch {
                // A missing chapter's topics just leaves those questions chapter-less.
            }
        }),
    );

    return { chapters, topicToChapter };
};

/** A single question as returned by the contest-questions endpoint (only `id` is used here). */
interface ContestQuestionLite {
    id: string;
}

/** Fetch the question list for one contest. */
export const getContestQuestions = (contestId: string) =>
    apiClient
        .get<{ questions: ContestQuestionLite[] }>(`/api/v1/contests/${contestId}/questions`)
        .then(r => (r.data?.questions ?? []).map(q => q.id));

/**
 * Build the set of question IDs that have already appeared in ANY contest
 * (upcoming or past). Used by the contest builder to filter those questions out
 * of the selection pool so the same question is never offered twice. Purely
 * client-side — no backend change required.
 *
 * Failures for individual contests are swallowed so one bad contest can't break
 * the whole picker; the worst case is a question not being filtered out.
 */
export const getUsedQuestionIds = async (): Promise<Set<string>> => {
    const [upcoming, past] = await Promise.all([
        getContests("upcoming").catch(() => [] as Contest[]),
        getContests("past").catch(() => [] as Contest[]),
    ]);

    // De-dupe contests by id (a contest could in principle appear in both lists).
    const contests = Array.from(new Map([...upcoming, ...past].map(c => [c.id, c])).values());

    const idLists = await Promise.all(
        contests.map(c => getContestQuestions(c.id).catch(() => [] as string[]))
    );

    const used = new Set<string>();
    for (const ids of idLists) for (const id of ids) used.add(id);
    return used;
};

// --- Contest detail / overview (read-only management views) ---

/**
 * A contest question with full detail, as returned by
 * `GET /contests/{id}/questions`. Mirrors the backend ContestQuestionResponse.
 */
export interface ContestQuestionDetail {
    id: string;
    topic_id: string;
    subject_id?: string | null;
    subject_name?: string | null;
    type: string; // "scq" | "mcq" | "integer" | "match_the_column"
    difficulty: number; // 1=Easy 2=Medium 3=Hard
    exam_type: ExamType[];
    question_text: string;
    marks: number;
    solution_text: string;
    question_image?: string | null;
    integer_answer?: number | null;
    mcq_options?: string[] | null;
    mcq_correct_option?: number[] | null;
    scq_options?: string[] | null;
    scq_correct_options?: number | null;
    questions_solved: number;
}

/** Fetch the full question list (with options, answers, solutions) for one contest. */
export const getContestQuestionsFull = (contestId: string) =>
    apiClient
        .get<{ questions: ContestQuestionDetail[] }>(`/api/v1/contests/${contestId}/questions`)
        .then(r => r.data?.questions ?? []);

/**
 * Find a single contest by id. The backend has no `GET /contests/{id}`, so we
 * fetch the upcoming and past lists and locate it. This survives a hard refresh /
 * deep-link (we don't rely on navigation state). Returns null if not found.
 */
export const findContestById = async (contestId: string): Promise<Contest | null> => {
    const [upcoming, past] = await Promise.all([
        getContests("upcoming").catch(() => [] as Contest[]),
        getContests("past").catch(() => [] as Contest[]),
    ]);
    return [...upcoming, ...past].find(c => c.id === contestId) ?? null;
};

/** One row of a contest's leaderboard / ranking. Mirrors ContestRankingUserResponse. */
export interface ContestRankingUser {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    score: number;
    rank: number;
    rating_before: number;
    rating_after: number;
    rating_delta: number;
    accuracy: number;
    attempted: number;
    correct: number;
    incorrect: number;
}

export interface ContestRankingResponse {
    users: ContestRankingUser[];
    total: number; // total participants
    skip: number;
    limit: number;
    current_user_rank?: number | null;
}

/**
 * Fetch a contest's leaderboard/ranking. NOTE: the backend scopes this to the
 * requesting user's class, so it returns rows only for contests in the admin's
 * own class. Callers must handle an empty result gracefully.
 */
export const getContestRanking = (contestId: string, params?: { skip?: number; limit?: number }) =>
    apiClient
        .get<ContestRankingResponse>(`/api/v1/contest-ranking/${contestId}`, { params })
        .then(r => r.data);
