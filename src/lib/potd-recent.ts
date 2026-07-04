/**
 * Remembers which questions the admin recently ADDED to the POTD pool, so the
 * Schedule tab can float them to the top. The backend exposes no "added_at"
 * timestamp on questions and no sort option, so we track this client-side.
 *
 * Stored in localStorage, keyed by exam (pool membership is exam-scoped): a map
 * of question_id -> epoch millis of when it was added. Read back as an
 * id -> rank map (0 = most recent) for stable sorting. Entries are pruned to a
 * trailing window so the store can't grow without bound.
 */

const KEY_PREFIX = "potd:recently-added:v1:";
const MAX_ENTRIES = 500; // per exam; older adds fall off

type Store = Record<string, number>; // question_id -> addedAt (ms)

function keyFor(exam: string): string {
    return `${KEY_PREFIX}${exam}`;
}

function read(exam: string): Store {
    if (typeof window === "undefined" || !exam) return {};
    try {
        return JSON.parse(window.localStorage.getItem(keyFor(exam)) || "{}") as Store;
    } catch {
        return {};
    }
}

/** Record that `ids` were just added to the POTD pool for `exam`. */
export function recordRecentlyAdded(exam: string, ids: string[], nowMs: number): void {
    if (typeof window === "undefined" || !exam || ids.length === 0) return;
    try {
        const store = read(exam);
        for (const id of ids) store[id] = nowMs;
        // Prune to the most-recent MAX_ENTRIES by timestamp.
        const kept = Object.entries(store)
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_ENTRIES);
        window.localStorage.setItem(keyFor(exam), JSON.stringify(Object.fromEntries(kept)));
    } catch {
        /* storage full / disabled — sorting just won't reflect the latest adds */
    }
}

/**
 * Return an id -> rank map for `exam`, where rank 0 is the most recently added.
 * Questions not in the map aren't recently-added (sort them after).
 */
export function recentlyAddedRanks(exam: string): Map<string, number> {
    const store = read(exam);
    const ordered = Object.entries(store).sort((a, b) => b[1] - a[1]); // newest first
    const ranks = new Map<string, number>();
    ordered.forEach(([id], i) => ranks.set(id, i));
    return ranks;
}
