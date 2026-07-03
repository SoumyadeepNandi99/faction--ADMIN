import { runMetric } from "@/lib/analytics/handler";
import { getActiveSolversSeries, getActiveSummary, getSignupSeries } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function engagement(f: AnalyticsFilters) {
    const [summary, solvers, signups] = await Promise.all([
        getActiveSummary(f),
        getActiveSolversSeries(f),
        getSignupSeries(f),
    ]);
    return { summary, solvers, signups };
}

export function GET(req: Request) {
    return runMetric(req, engagement);
}
