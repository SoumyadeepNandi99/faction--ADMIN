import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/require-admin";
import { AnalyticsDbError, isDbConfigured } from "@/lib/db";
import { getEvent } from "@/lib/events/config";
import { getEventLeaderboard } from "@/lib/events/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/:eventId/leaderboard
 * Admin-gated, read-only leaderboard for an event (currently the World Cup /
 * Legends season). Reuses the same admin session + read-only Postgres path as
 * Founder Analytics — it never writes and only exists in the admin app.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;

    const { eventId } = await params;
    const event = getEvent(eventId);
    if (!event) {
        return NextResponse.json({ error: "not_found", detail: "Unknown event." }, { status: 404 });
    }

    if (!isDbConfigured()) {
        return NextResponse.json(
            { error: "not_configured", detail: "ANALYTICS_DATABASE_URL is not set on the server." },
            { status: 503 },
        );
    }

    try {
        const leaderboard = await getEventLeaderboard(300);
        return NextResponse.json(
            { data: { leaderboard } },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (err) {
        if (err instanceof AnalyticsDbError) {
            const status = err.code === "not_configured" ? 503 : err.code === "unsafe_query" ? 400 : 500;
            return NextResponse.json({ error: err.code, detail: err.message }, { status });
        }
        const detail = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "query_failed", detail }, { status: 500 });
    }
}
