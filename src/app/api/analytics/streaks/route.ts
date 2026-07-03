import { runMetric } from "@/lib/analytics/handler";
import { getStreakDistribution, getStreakSummary } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function streaks(f: AnalyticsFilters) {
    const [summary, distribution] = await Promise.all([getStreakSummary(f), getStreakDistribution(f)]);
    return { summary, distribution };
}

export function GET(req: Request) {
    return runMetric(req, streaks);
}
