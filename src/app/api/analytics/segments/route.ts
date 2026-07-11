import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/require-admin";
import { AnalyticsDbError, isDbConfigured } from "@/lib/db";
import { SEGMENTS, getSegmentUserIds, getClassUserIds, isSegmentKey } from "@/lib/analytics/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/segments
 *   (no param)          → { segments: [{key,label,description}, …] }  (catalogue)
 *   ?segment=<key>      → { segment, count, userIds }                 (resolved segment audience)
 *   ?classId=<uuid>     → { classId, count, userIds }                 (resolved class-wise audience)
 *
 * Admin-gated and read-only, like the rest of the analytics routes. The returned
 * userIds are fed to the existing POST /notifications/admin/send endpoint.
 */
export async function GET(req: Request) {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.response;

    const params = new URL(req.url).searchParams;
    const segment = params.get("segment");
    const classId = params.get("classId");

    // No param → return the catalogue (works even without a DB connection).
    if (!segment && !classId) {
        return NextResponse.json({ segments: SEGMENTS }, { headers: { "Cache-Control": "no-store" } });
    }

    if (segment && !isSegmentKey(segment)) {
        return NextResponse.json({ error: "unknown_segment", detail: `Unknown segment '${segment}'.` }, { status: 400 });
    }

    if (!isDbConfigured()) {
        return NextResponse.json(
            { error: "not_configured", detail: "ANALYTICS_DATABASE_URL is not set on the server." },
            { status: 503 },
        );
    }

    try {
        // Class-wise resolution — all STUDENT users in the picked class.
        if (classId) {
            const userIds = await getClassUserIds(classId);
            return NextResponse.json(
                { classId, count: userIds.length, userIds },
                { headers: { "Cache-Control": "no-store" } },
            );
        }

        const userIds = await getSegmentUserIds(segment as Parameters<typeof getSegmentUserIds>[0]);
        return NextResponse.json(
            { segment, count: userIds.length, userIds },
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
