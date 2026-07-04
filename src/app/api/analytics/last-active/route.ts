import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/require-admin";
import { AnalyticsDbError, isDbConfigured } from "@/lib/db";
import { getLastActiveMap } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/last-active
 * Admin-only, read-only. Returns a { userId: lastActiveISO|null } map so the
 * Users table can show a real "Last Active" column (the REST users endpoint
 * doesn't expose one).
 */
export async function GET(req: Request) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;

    if (!isDbConfigured()) {
        return NextResponse.json(
            { error: "not_configured", detail: "ANALYTICS_DATABASE_URL is not set on the server." },
            { status: 503 },
        );
    }

    try {
        const rows = await getLastActiveMap();
        const map: Record<string, string | null> = {};
        for (const r of rows) map[r.user_id] = r.last_active;
        return NextResponse.json({ lastActive: map }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
        if (err instanceof AnalyticsDbError) {
            const status = err.code === "not_configured" ? 503 : err.code === "unsafe_query" ? 400 : 500;
            return NextResponse.json({ error: err.code, detail: err.message }, { status });
        }
        const detail = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "query_failed", detail }, { status: 500 });
    }
}
