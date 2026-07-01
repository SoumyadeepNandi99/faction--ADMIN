import { apiClient } from "@/lib/axios";

/**
 * Founder Analytics — data layer.
 *
 * HARD CONSTRAINT: this dashboard is derived ENTIRELY from existing backend
 * endpoints. No new backend routes, DB columns, cron jobs or business logic are
 * introduced. Every metric below is computed client-side from data the admin
 * panel already had access to. Anything that genuinely cannot be derived from
 * the available APIs is surfaced as an explicit "Data Not Available" state in
 * the UI rather than faked.
 *
 * Endpoints consumed (all pre-existing):
 *   GET /api/v1/users/                     — user directory (paginated)
 *   GET /api/v1/arena-ranking/             — questions-solved ranking (time-filtered)
 *   GET /api/v1/rating-ranking/            — rating ranking
 *   GET /api/v1/streak-ranking/            — streak ranking
 *   GET /api/v1/leaderboard/top-performers — best rating / delta / questions
 *   GET /api/v1/contests/?type=            — contest list (upcoming | past)
 *   GET /api/v1/contest-ranking/{id}       — per-contest ranking (class-scoped)
 *   GET /api/v1/class/                      — class directory
 */

// ---------------------------------------------------------------------------
// Shapes (a subset of each endpoint — only the fields we actually read)
// ---------------------------------------------------------------------------

export interface AnalyticsUser {
    id: string;
    name: string;
    role: "STUDENT" | "ADMIN";
    is_active: boolean;
    created_at: string;
    class_id?: string | null;
    target_exams?: string[];
    batch?: string | null;
    state?: string | null;
    city?: string | null;
}

export interface ArenaRankRow {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    questions_solved: number;
}

export interface RatingRankRow {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    current_rating: number;
    max_rating: number;
    title: string;
}

export interface StreakRankRow {
    user_id: string;
    user_name: string;
    avatar_url?: string | null;
    streak_count: number;
}

export interface TopPerformers {
    best_rating?: { user: { name?: string; user_name?: string } | null; metric_value: number } | null;
    best_delta?: { user: { name?: string; user_name?: string } | null; metric_value: number } | null;
    best_questions?: { user: { name?: string; user_name?: string } | null; metric_value: number } | null;
}

export interface ContestRow {
    id: string;
    name: string;
    class_id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    exam_type: string;
    created_at: string;
}

export interface ClassRow {
    id: string;
    name: string;
}

// arena-ranking accepts these time windows only. The backend enum is
// daily | weekly | all_time (all_time == omit the param). There is deliberately
// NO monthly window — hence MAU is reported as "Data Not Available".
export type TimeFilter = "daily" | "weekly";

const USERS_PAGE = 200; // backend caps the users list at 200 rows/page
const RANK_PAGE = 100; // backend caps ranking endpoints at 100 rows/page
const MAX_USER_PAGES = 100; // safety bound: up to 20k users

// ---------------------------------------------------------------------------
// Fetchers — each swallows failures into an empty result so one dead endpoint
// never blanks the whole dashboard; the derivation layer decides what "no data"
// means per card.
// ---------------------------------------------------------------------------

/**
 * Walk `GET /users/` until a short page comes back. The endpoint returns a bare
 * array (no total), so we page by returned count and stop on the first
 * under-full page, bounded by MAX_USER_PAGES.
 */
export async function fetchAllUsers(): Promise<AnalyticsUser[]> {
    const out: AnalyticsUser[] = [];
    for (let page = 0; page < MAX_USER_PAGES; page++) {
        let rows: AnalyticsUser[];
        try {
            const { data } = await apiClient.get<AnalyticsUser[]>("/api/v1/users/", {
                params: { skip: page * USERS_PAGE, limit: USERS_PAGE },
            });
            rows = Array.isArray(data) ? data : [];
        } catch {
            break; // return whatever we already collected
        }
        out.push(...rows);
        if (rows.length < USERS_PAGE) break;
    }
    return out;
}

// Ranking endpoints are not perfectly uniform in their field names (the
// leaderboard page already defends across `metric_value` / `score`). We
// normalise each row into our typed shape and coerce the metric to a number so
// a renamed/absent field degrades to 0 instead of crashing a `.toLocaleString`.
type RawRow = Record<string, unknown>;
const num = (...vals: unknown[]): number => {
    for (const v of vals) {
        const n = typeof v === "string" ? Number(v) : v;
        if (typeof n === "number" && Number.isFinite(n)) return n;
    }
    return 0;
};
const str = (...vals: unknown[]): string => {
    for (const v of vals) if (typeof v === "string" && v) return v;
    return "";
};
const rowsOf = (data: unknown): RawRow[] => {
    const d = data as { users?: RawRow[]; rankings?: RawRow[] } | RawRow[] | null;
    if (Array.isArray(d)) return d;
    return d?.users ?? d?.rankings ?? [];
};

/** Top solvers for a time window (or all-time when `time_filter` omitted). */
export async function fetchArenaRanking(time_filter?: TimeFilter, exam_type?: string): Promise<ArenaRankRow[]> {
    try {
        const params: Record<string, string | number> = { skip: 0, limit: RANK_PAGE };
        if (time_filter) params.time_filter = time_filter;
        if (exam_type) params.exam_type = exam_type;
        const { data } = await apiClient.get("/api/v1/arena-ranking/", { params });
        return rowsOf(data).map(u => ({
            user_id: str(u.user_id, u.id),
            user_name: str(u.user_name, u.name),
            avatar_url: (u.avatar_url as string) ?? null,
            questions_solved: num(u.questions_solved, u.metric_value, u.score),
        }));
    } catch {
        return [];
    }
}

export async function fetchRatingRanking(exam_type?: string): Promise<RatingRankRow[]> {
    try {
        const params: Record<string, string | number> = { skip: 0, limit: RANK_PAGE };
        if (exam_type) params.exam_type = exam_type;
        const { data } = await apiClient.get("/api/v1/rating-ranking/", { params });
        return rowsOf(data).map(u => ({
            user_id: str(u.user_id, u.id),
            user_name: str(u.user_name, u.name),
            avatar_url: (u.avatar_url as string) ?? null,
            current_rating: num(u.current_rating, u.rating, u.metric_value),
            max_rating: num(u.max_rating, u.peak_rating, u.current_rating, u.rating),
            title: str(u.title),
        }));
    } catch {
        return [];
    }
}

export async function fetchStreakRanking(exam_type?: string): Promise<StreakRankRow[]> {
    try {
        const params: Record<string, string | number> = { skip: 0, limit: RANK_PAGE };
        if (exam_type) params.exam_type = exam_type;
        const { data } = await apiClient.get("/api/v1/streak-ranking/", { params });
        return rowsOf(data).map(u => ({
            user_id: str(u.user_id, u.id),
            user_name: str(u.user_name, u.name),
            avatar_url: (u.avatar_url as string) ?? null,
            streak_count: num(u.streak_count, u.current_streak, u.streak, u.metric_value),
        }));
    } catch {
        return [];
    }
}

export async function fetchTopPerformers(): Promise<TopPerformers | null> {
    try {
        const { data } = await apiClient.get<TopPerformers>("/api/v1/leaderboard/top-performers");
        return data ?? null;
    } catch {
        return null;
    }
}

export async function fetchContests(): Promise<ContestRow[]> {
    const grab = (type: "upcoming" | "past") =>
        apiClient
            .get(`/api/v1/contests/?type=${type}`)
            .then(r => {
                const d = r.data;
                return (Array.isArray(d) ? d : d?.contests ?? []) as ContestRow[];
            })
            .catch(() => [] as ContestRow[]);
    const [upcoming, past] = await Promise.all([grab("upcoming"), grab("past")]);
    // de-dupe by id (a contest could appear in both windows around its boundary)
    return Array.from(new Map([...upcoming, ...past].map(c => [c.id, c])).values());
}

export interface ContestRankingRow {
    user_id: string;
    user_name: string;
    score: number;
    rank: number;
    accuracy: number;
    attempted: number;
    correct: number;
}

/** Per-contest ranking. Backend scopes this to the admin's own class, so it can
 * legitimately return empty for contests outside that class. */
export async function fetchContestRanking(contestId: string): Promise<{ rows: ContestRankingRow[]; total: number }> {
    try {
        const { data } = await apiClient.get(`/api/v1/contest-ranking/${contestId}`, {
            params: { skip: 0, limit: RANK_PAGE },
        });
        const raw = rowsOf(data);
        const rows: ContestRankingRow[] = raw.map((u, i) => ({
            user_id: str(u.user_id, u.id),
            user_name: str(u.user_name, u.name),
            score: num(u.score, u.metric_value),
            rank: num(u.rank) || i + 1,
            accuracy: num(u.accuracy),
            attempted: num(u.attempted),
            correct: num(u.correct),
        }));
        const total = num((data as { total?: unknown })?.total) || rows.length;
        return { rows, total };
    } catch {
        return { rows: [], total: 0 };
    }
}

export async function fetchClasses(): Promise<ClassRow[]> {
    try {
        const { data } = await apiClient.get("/api/v1/class/");
        return (Array.isArray(data) ? data : data?.classes ?? []) as ClassRow[];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// IST date helpers — the backend stores UTC; the app presents everything in IST
// (Asia/Kolkata). All bucketing (day/hour/weekday) is done in IST so numbers
// line up with what students and admins actually experience.
// ---------------------------------------------------------------------------

const IST = "Asia/Kolkata";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // guarantees hour 00–23 (never "24")
    weekday: "short",
});

export interface IstParts {
    dateKey: string; // "YYYY-MM-DD" in IST
    hour: number; // 0–23
    weekday: string; // "Mon" … "Sun"
    weekdayIndex: number; // 0=Mon … 6=Sun
}

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function istParts(value: string | number | Date): IstParts | null {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    const parts = partsFmt.formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
    const hour = Number(get("hour"));
    const weekday = get("weekday");
    return {
        dateKey,
        hour: Number.isFinite(hour) ? hour : 0,
        weekday,
        weekdayIndex: Math.max(0, WEEKDAY_ORDER.indexOf(weekday)),
    };
}

/** "YYYY-MM-DD" for today in IST. */
export function istTodayKey(): string {
    return istParts(new Date())!.dateKey;
}

/** Add `days` to a "YYYY-MM-DD" key (calendar arithmetic, UTC-anchored to avoid DST — IST has none). */
export function shiftDateKey(key: string, days: number): string {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

/** Inclusive list of date keys from `start` to `end`. */
export function dateKeyRange(start: string, end: string): string[] {
    const out: string[] = [];
    let cur = start;
    // guard against inverted ranges / runaway loops (cap ~5y)
    for (let i = 0; i < 2000 && cur <= end; i++) {
        out.push(cur);
        cur = shiftDateKey(cur, 1);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Derivations — pure functions over fetched rows.
// ---------------------------------------------------------------------------

export interface DailyPoint {
    date: string; // "YYYY-MM-DD"
    count: number; // new that day
    cumulative: number; // running total
}

/** Registrations per IST day, back-filled so gaps render as zero, plus a running total. */
export function registrationSeries(users: AnalyticsUser[]): DailyPoint[] {
    const byDay = new Map<string, number>();
    for (const u of users) {
        const p = istParts(u.created_at);
        if (!p) continue;
        byDay.set(p.dateKey, (byDay.get(p.dateKey) ?? 0) + 1);
    }
    if (byDay.size === 0) return [];
    const keys = [...byDay.keys()].sort();
    const filled = dateKeyRange(keys[0], keys[keys.length - 1]);
    let running = 0;
    return filled.map(date => {
        const count = byDay.get(date) ?? 0;
        running += count;
        return { date, count, cumulative: running };
    });
}

export interface Bucket {
    label: string;
    count: number;
}

/** Count values into ordered ranges. Each edge is an inclusive lower bound. */
export function bucketize(values: number[], edges: { label: string; min: number; max?: number }[]): Bucket[] {
    return edges.map(e => ({
        label: e.label,
        count: values.filter(v => v >= e.min && (e.max === undefined || v <= e.max)).length,
    }));
}

/** Tally a categorical field, sorted by frequency desc. Nullish → the given fallback bucket. */
export function categoryCounts<T>(items: T[], key: (t: T) => string | null | undefined, fallback = "Unknown"): Bucket[] {
    const m = new Map<string, number>();
    for (const it of items) {
        const raw = key(it);
        const label = raw && raw.trim() ? raw : fallback;
        m.set(label, (m.get(label) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Tally an array-valued field (e.g. target_exams) — each user counts once per value. */
export function multiCategoryCounts<T>(items: T[], key: (t: T) => string[] | null | undefined): Bucket[] {
    const m = new Map<string, number>();
    for (const it of items) {
        for (const v of key(it) ?? []) {
            if (!v) continue;
            m.set(v, (m.get(v) ?? 0) + 1);
        }
    }
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function mean(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Distribution of a timestamp field across the 24 IST hours. */
export function hourDistribution(items: { created_at: string }[]): number[] {
    const hours = new Array(24).fill(0);
    for (const it of items) {
        const p = istParts(it.created_at);
        if (p) hours[p.hour] += 1;
    }
    return hours;
}

/** Distribution of a timestamp field across weekdays (Mon…Sun). */
export function weekdayDistribution(items: { created_at: string }[]): Bucket[] {
    const counts = new Array(7).fill(0);
    for (const it of items) {
        const p = istParts(it.created_at);
        if (p) counts[p.weekdayIndex] += 1;
    }
    return WEEKDAY_ORDER.map((label, i) => ({ label, count: counts[i] }));
}

// ---------------------------------------------------------------------------
// KPI snapshots — the only way to get REAL day-over-day deltas & sparklines
// without a backend timeseries. We persist a small daily snapshot of each KPI
// in localStorage (keyed by IST date) and read the trailing window back. This
// is honest: on first load there is no history, so deltas render as "—" until
// snapshots accumulate.
// ---------------------------------------------------------------------------

const SNAP_KEY = "founder-analytics:kpi-snapshots:v1";
const SNAP_MAX_DAYS = 60;

export type KpiSnapshot = Record<string, number>;
type SnapshotStore = Record<string, KpiSnapshot>; // dateKey -> { metric: value }

function readStore(): SnapshotStore {
    if (typeof window === "undefined") return {};
    try {
        return JSON.parse(window.localStorage.getItem(SNAP_KEY) || "{}") as SnapshotStore;
    } catch {
        return {};
    }
}

/** Record today's KPI values (idempotent within a day; last write wins). */
export function saveSnapshot(values: KpiSnapshot): void {
    if (typeof window === "undefined") return;
    try {
        const store = readStore();
        store[istTodayKey()] = { ...store[istTodayKey()], ...values };
        // prune to the trailing window
        const keep = Object.keys(store)
            .sort()
            .slice(-SNAP_MAX_DAYS);
        const pruned: SnapshotStore = {};
        for (const k of keep) pruned[k] = store[k];
        window.localStorage.setItem(SNAP_KEY, JSON.stringify(pruned));
    } catch {
        /* storage full / disabled — deltas simply won't accrue */
    }
}

/** Trailing series of a single metric (oldest → newest), for sparklines. */
export function snapshotSeries(metric: string): number[] {
    const store = readStore();
    return Object.keys(store)
        .sort()
        .map(k => store[k][metric])
        .filter((v): v is number => typeof v === "number");
}

export interface Delta {
    value: number; // signed change vs the previous recorded day
    pct: number | null; // percent change, null if no prior baseline
    available: boolean; // false until we have ≥2 days of history
}

/** Change of `metric` between the two most-recent snapshot days. */
export function snapshotDelta(metric: string, current: number): Delta {
    const series = snapshotSeries(metric);
    // the most recent entry may be today's just-saved value; compare against the prior distinct day
    const prior = series.length >= 2 ? series[series.length - 2] : undefined;
    if (prior === undefined) return { value: 0, pct: null, available: false };
    const value = current - prior;
    const pct = prior === 0 ? null : (value / prior) * 100;
    return { value, pct, available: true };
}
