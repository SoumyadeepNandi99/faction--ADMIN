import { runMetric } from "@/lib/analytics/handler";
import { getLegendsProgress } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/legends[?stream=JEE|NEET|FOUNDATION]
 *   → { rows: LegendsProgressRow[] }
 *
 * Per-student Faction Legends challenge progress (correct solves since launch,
 * scoped to the student's stream subjects). Admin-gated + read-only, like the
 * rest of the analytics routes. Omit `stream` for all streams.
 */
export function GET(req: Request) {
    const stream = new URL(req.url).searchParams.get("stream") ?? undefined;
    return runMetric(req, async () => ({ rows: await getLegendsProgress(stream) }));
}
