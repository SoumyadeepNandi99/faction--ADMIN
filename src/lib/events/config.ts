/**
 * Events module — event catalogue (CRM-side config).
 *
 * The Faction app runs its live "World Cup" event entirely on the client as the
 * **Faction Legends** season (`faction-app/src/features/legends/legendsConfig.js`:
 * `SEASON.name = "World Cup"`, window 2026-07-05 → 2026-07-20). There is no
 * backend/DB record for it, so this admin module mirrors that same event
 * definition here and reports on it read-only. We do NOT add anything to the app
 * or backend — the leaderboard below is derived purely from existing study-stats.
 *
 * If more events are added later, append to EVENTS; the list + detail pages are
 * generic over this shape.
 */

export type EventStatus = "ongoing" | "upcoming" | "ended";

export interface EventDef {
    /** Stable slug used in the URL (/events/[eventId]). */
    id: string;
    name: string;
    /** Short tag shown as a pill (e.g. "WORLD CUP"). */
    tag: string;
    description: string;
    /** ISO date (inclusive) the event window opens. */
    startDateISO: string;
    /** ISO date (inclusive) the event window closes. */
    endDateISO: string;
    /**
     * How the leaderboard ranks participants. Currently only "questions_solved",
     * mirroring the Legends "Progress" number (subject-scoped solves surfaced from
     * the app's study-stats). Kept as a field so future events can rank differently.
     */
    metric: "questions_solved";
    /** Emoji/name used for card accent. */
    emoji: string;
}

export const EVENTS: EventDef[] = [
    {
        id: "world-cup",
        name: "Faction Legends — World Cup",
        tag: "WORLD CUP",
        description:
            "Solve to build your Dream XI. Students climb the World Cup board by the number of questions they solve during the season. Progress mirrors each student's Faction Legends progress in the app.",
        startDateISO: "2026-07-05",
        endDateISO: "2026-07-20",
        metric: "questions_solved",
        emoji: "🏆",
    },
];

export function getEvent(id: string): EventDef | undefined {
    return EVENTS.find(e => e.id === id);
}

/**
 * Ongoing / upcoming / ended relative to a reference instant (defaults to now).
 * The window is inclusive of both dates; comparison is on the calendar date.
 */
export function eventStatus(e: EventDef, now: Date = new Date()): EventStatus {
    const today = now.toISOString().slice(0, 10);
    if (today < e.startDateISO) return "upcoming";
    if (today > e.endDateISO) return "ended";
    return "ongoing";
}
