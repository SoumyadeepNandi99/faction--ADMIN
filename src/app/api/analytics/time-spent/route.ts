import { runMetric } from "@/lib/analytics/handler";
import { getTimeSpentSeries, getTimeSpentSummary } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function timeSpent(f: AnalyticsFilters) {
    const [summary, series] = await Promise.all([
        getTimeSpentSummary(f),
        getTimeSpentSeries(f),
    ]);
    return { summary, series };
}

export function GET(req: Request) {
    return runMetric(req, timeSpent);
}
