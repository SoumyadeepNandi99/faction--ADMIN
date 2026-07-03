import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/require-admin";
import { AnalyticsDbError, isDbConfigured } from "@/lib/db";
import type { AnalyticsFilters } from "./filters";

/**
 * Shared plumbing for every analytics API route:
 *   1. gate on ADMIN (reusing the backend session),
 *   2. parse the segmentation filters from the query string,
 *   3. run the metric fn,
 *   4. translate DB failures into structured, non-crashing JSON.
 *
 * Each card on the client can therefore render a precise loading / empty /
 * error / not-configured state without the page ever blanking out.
 */

export function parseFilters(url: URL): AnalyticsFilters {
    const p = url.searchParams;
    const from = p.get("from") || undefined;
    const to = p.get("to") || undefined;
    const classId = p.get("classId") || undefined;
    const subscriptionType = p.get("subscriptionType") || undefined;
    const examParam = p.get("examTypes") || "";
    const examTypes = examParam ? examParam.split(",").map(s => s.trim()).filter(Boolean) : undefined;

    // Light validation: dates must look like YYYY-MM-DD; enum-ish values are
    // bound as params so they can't inject, but we still whitelist obvious ones.
    const dateOk = (v?: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
    return {
        from: dateOk(from) ? from : undefined,
        to: dateOk(to) ? to : undefined,
        classId,
        subscriptionType: subscriptionType === "FREE" || subscriptionType === "PREMIUM" ? subscriptionType : undefined,
        examTypes,
    };
}

export async function runMetric<T>(
    req: Request,
    fn: (filters: AnalyticsFilters) => Promise<T>,
): Promise<NextResponse> {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;

    if (!isDbConfigured()) {
        return NextResponse.json(
            { error: "not_configured", detail: "ANALYTICS_DATABASE_URL is not set on the server." },
            { status: 503 },
        );
    }

    try {
        const filters = parseFilters(new URL(req.url));
        const data = await fn(filters);
        return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        if (err instanceof AnalyticsDbError) {
            const status = err.code === "not_configured" ? 503 : err.code === "unsafe_query" ? 400 : 500;
            return NextResponse.json({ error: err.code, detail: err.message }, { status });
        }
        const detail = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "query_failed", detail }, { status: 500 });
    }
}
