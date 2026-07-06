import { runMetric } from "@/lib/analytics/handler";
import { getMostActiveUsers, getTopUserPerDay } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function activeUsers(f: AnalyticsFilters) {
    const [leaderboard, perDay] = await Promise.all([
        getMostActiveUsers(f, 50),
        getTopUserPerDay(f),
    ]);
    return { leaderboard, perDay };
}

export function GET(req: Request) {
    return runMetric(req, activeUsers);
}
