/** Small formatting helpers shared across analytics cards. */

/** A percentage that may be null (no denominator) → "—". */
export function pct(v: number | null | undefined): string {
    return v == null ? "—" : `${v}%`;
}

/** A number that may be null → "—", else locale-grouped. */
export function n(v: number | null | undefined): string {
    return v == null ? "—" : v.toLocaleString();
}

/** A KPI value that may be null → "—". Accepts an optional suffix. */
export function kpi(v: number | null | undefined, suffix = ""): string {
    return v == null ? "—" : `${v.toLocaleString()}${suffix}`;
}

/** Hours → a human string ("~7 min", "3.2 h", "1.4 d"). */
export function humanHours(h: number | null | undefined): string {
    if (h == null) return "—";
    if (h < 1) return `~${Math.round(h * 60)} min`;
    if (h < 48) return `${h.toFixed(1)} h`;
    return `${(h / 24).toFixed(1)} d`;
}

/** Seconds → a compact duration ("0m", "12m", "1h 05m", "3h"). */
export function humanDuration(sec: number | null | undefined): string {
    if (sec == null || sec <= 0) return "0m";
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${String(m).padStart(2, "0")}m`;
}
