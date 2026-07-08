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

// --- Admin: ALL contests, unscoped by the admin's class/exam ---
// Backed by GET /api/v1/admin/contests (admin-only). Returns contests across
// every class and exam, with server-side filters + pagination. The student
// GET /contests/?type= stays scoped; this is the admin panel's list source.

export interface AdminContestFilters {
    type?: "upcoming" | "past" | "all";
    class_id?: string;
    exam_type?: ExamType;
    status?: ContestStatus;
    search?: string;
    skip?: number;
    limit?: number;
}

export interface AdminContestListResult {
    contests: Contest[];
    total: number;
    skip: number;
    limit: number;
}

/** Detects whether the admin-contests endpoints are deployed. Cached after the
 * first call so we don't repeatedly probe a backend that hasn't shipped them yet.
 * `null` = untested, `true`/`false` = the probed result. */
let adminContestsAvailable: boolean | null = null;
let adminQuestionsAvailable: boolean | null = null;

export const getAllContestsAdmin = async (filters: AdminContestFilters = {}): Promise<AdminContestListResult> => {
    const params: Record<string, string | number> = {};
    if (filters.type) params.type = filters.type;
    if (filters.class_id) params.class_id = filters.class_id;
    if (filters.exam_type) params.exam_type = filters.exam_type;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;
    params.skip = filters.skip ?? 0;
    params.limit = filters.limit ?? 50;
    const { data } = await apiClient.get("/api/v1/admin/contests", { params });
    adminContestsAvailable = true;
    return {
        contests: (data?.contests ?? []) as Contest[],
        total: Number(data?.total ?? (data?.contests?.length ?? 0)),
        skip: Number(data?.skip ?? params.skip),
        limit: Number(data?.limit ?? params.limit),
    };
};

/**
 * List contests for the admin panel. Prefers the unscoped admin endpoint; if it
 * isn't deployed yet (404), falls back to the old class/exam-scoped
 * `GET /contests/?type=` so the panel keeps working before/after the backend
 * deploy. `type: "all"` maps to fetching upcoming + past on the fallback path.
 */
export const listContestsForAdmin = async (filters: AdminContestFilters = {}): Promise<AdminContestListResult> => {
    if (adminContestsAvailable !== false) {
        try {
            return await getAllContestsAdmin(filters);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            // Only fall back when the endpoint genuinely isn't there (404/405).
            if (status === 404 || status === 405) {
                adminContestsAvailable = false;
            } else {
                throw err;
            }
        }
    }
    // Fallback: scoped endpoints (only the admin's own class/exam).
    const type = filters.type ?? "all";
    const wanted: ("upcoming" | "past")[] = type === "all" ? ["upcoming", "past"] : [type];
    const lists = await Promise.all(wanted.map(t => getContests(t).catch(() => [] as Contest[])));
    const merged = Array.from(new Map(lists.flat().map(c => [c.id, c])).values());
    return { contests: merged, total: merged.length, skip: 0, limit: merged.length };
};

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
    // Present on the questions API (QuestionResponse); used to sort "recently added".
    created_at?: string | null;
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
interface TopicLite { id: string; name: string; chapter_id: string }

export interface ChapterRef { chapterId: string; chapterName: string; }
/** A canonical subtopic (topic row) with its parent chapter, for labels + filters. */
export interface SubtopicRef { topicId: string; topicName: string; chapterId: string }

/**
 * For a subject, return the chapter list (filter dropdown), and maps from each
 * topic_id to its chapter and to its subtopic name, plus the subtopics grouped by
 * chapter (for the subtopic filter). Topic lists are fetched per chapter, in
 * parallel; each chapter's topics are returned by the API in canonical order,
 * which we preserve in `subtopicsByChapter`.
 */
export const getSubjectChapterMap = async (
    subjectId: string,
): Promise<{
    chapters: ChapterRef[];
    topicToChapter: Map<string, ChapterRef>;
    topicToSubtopic: Map<string, string>;
    subtopicsByChapter: Map<string, SubtopicRef[]>;
}> => {
    const { data: chapterData } = await apiClient.get<{ chapters?: ChapterLite[] }>(
        "/api/v1/chapters/",
        { params: { subject_id: subjectId } },
    );
    const chapterList = chapterData?.chapters ?? [];
    const chapters: ChapterRef[] = chapterList.map(c => ({ chapterId: c.id, chapterName: c.name }));

    const topicToChapter = new Map<string, ChapterRef>();
    const topicToSubtopic = new Map<string, string>();
    const subtopicsByChapter = new Map<string, SubtopicRef[]>();
    await Promise.all(
        chapters.map(async ch => {
            try {
                const { data } = await apiClient.get<{ topics?: TopicLite[] }>("/api/v1/topics/", {
                    params: { chapter_id: ch.chapterId },
                });
                const list: SubtopicRef[] = [];
                for (const t of data?.topics ?? []) {
                    topicToChapter.set(t.id, ch);
                    if (t.name) topicToSubtopic.set(t.id, t.name);
                    list.push({ topicId: t.id, topicName: t.name, chapterId: ch.chapterId });
                }
                subtopicsByChapter.set(ch.chapterId, list);
            } catch {
                // A missing chapter's topics just leaves those questions chapter-less.
            }
        }),
    );

    return { chapters, topicToChapter, topicToSubtopic, subtopicsByChapter };
};

/** A single question as returned by the contest-questions endpoint (only `id` is used here). */
interface ContestQuestionLite {
    id: string;
}

/** Fetch just the question IDs for one contest (used for cross-contest dedup).
 * Uses the admin preview route so UPCOMING contests are included (the student
 * route 400s before start); falls back to the student route if not deployed. */
export const getContestQuestions = async (contestId: string): Promise<string[]> => {
    if (adminQuestionsAvailable !== false) {
        try {
            const { data } = await apiClient.get<{ questions: ContestQuestionLite[] }>(
                `/api/v1/admin/contests/${contestId}/questions`,
            );
            adminQuestionsAvailable = true;
            return (data?.questions ?? []).map(q => q.id);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status !== 404 && status !== 405) return []; // e.g. 400 not-started on fallback path
            adminQuestionsAvailable = false;
        }
    }
    return apiClient
        .get<{ questions: ContestQuestionLite[] }>(`/api/v1/contests/${contestId}/questions`)
        .then(r => (r.data?.questions ?? []).map(q => q.id))
        .catch(() => [] as string[]);
};

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
    // Span ALL contests (every class/exam) via the admin list so a question used
    // in another class's contest is still excluded. Falls back to scoped lists.
    const { contests } = await listContestsForAdmin({ type: "all", limit: 200 }).catch(
        () => ({ contests: [] as Contest[], total: 0, skip: 0, limit: 0 }),
    );

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
 * Fetch a contest's full paper for the admin panel. Prefers the admin preview
 * endpoint (GET /api/v1/admin/contests/{id}/questions), which bypasses the
 * start-time gate so UPCOMING contests' papers load. Falls back to the student
 * endpoint if the admin route isn't deployed yet — note the fallback still 400s
 * ("Contest has not started yet") for not-yet-started contests, which the detail
 * page surfaces as a clear message.
 */
export const getContestQuestionsForAdmin = async (contestId: string): Promise<ContestQuestionDetail[]> => {
    if (adminQuestionsAvailable !== false) {
        try {
            const { data } = await apiClient.get<{ questions: ContestQuestionDetail[] }>(
                `/api/v1/admin/contests/${contestId}/questions`,
            );
            adminQuestionsAvailable = true;
            return data?.questions ?? [];
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404 || status === 405) {
                adminQuestionsAvailable = false;
            } else {
                throw err; // real error (incl. 400 "not started" on the admin route shouldn't happen)
            }
        }
    }
    return getContestQuestionsFull(contestId);
};

/**
 * Find a single contest by id. The backend has no `GET /contests/{id}`, so we
 * locate it in the admin list (which spans ALL classes/exams, so deep-linking a
 * contest outside the admin's own scope still resolves). Falls back to the
 * scoped lists automatically via listContestsForAdmin. Returns null if not found.
 */
export const findContestById = async (contestId: string): Promise<Contest | null> => {
    const { contests } = await listContestsForAdmin({ type: "all", limit: 200 }).catch(
        () => ({ contests: [] as Contest[], total: 0, skip: 0, limit: 0 }),
    );
    return contests.find(c => c.id === contestId) ?? null;
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
