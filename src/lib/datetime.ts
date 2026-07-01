/**
 * Centralized date/time formatting for the admin — ALWAYS renders in IST
 * (Asia/Kolkata), regardless of the admin's browser timezone.
 *
 * The backend sends timestamps as UTC ISO strings (with a `Z`/`+00:00` offset),
 * so `new Date(iso)` yields the correct absolute instant; we then force the
 * display timezone to IST via `timeZone: 'Asia/Kolkata'`.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

const toDate = (value: string | number | Date | null | undefined): Date | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
};

/** e.g. "17 Jun 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleDateString(LOCALE, {
        timeZone: IST_TIMEZONE,
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/** e.g. "17 Jun 2026, 07:00 PM" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleString(LOCALE, {
        timeZone: IST_TIMEZONE,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** e.g. "07:00 PM" */
export function formatTime(value: string | number | Date | null | undefined): string {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleTimeString(LOCALE, {
        timeZone: IST_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
    });
}
