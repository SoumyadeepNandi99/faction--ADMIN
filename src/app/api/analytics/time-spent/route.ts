import { runMetric } from "@/lib/analytics/handler";
import { getTimeSpentSummary } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function timeSpent(f: AnalyticsFilters) {
    return { summary: await getTimeSpentSummary(f) };
}

export function GET(req: Request) {
    return runMetric(req, timeSpent);
}
