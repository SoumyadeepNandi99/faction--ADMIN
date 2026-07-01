import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** Extract a displayable string from an axios error's response.data.detail,
 *  which may be a plain string or a FastAPI validation-error array. */
export function getApiError(err: unknown, fallback: string): string {
    const detail = (err as any)?.response?.data?.detail;
    if (!detail) return fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        const msg = detail.map((d: any) => d?.msg ?? String(d)).filter(Boolean).join("; ");
        return msg || fallback;
    }
    return fallback;
}
