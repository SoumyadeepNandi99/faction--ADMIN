import { runMetric } from "@/lib/analytics/handler";
import { getActivationSummary, getRetentionCohorts } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function activation(f: AnalyticsFilters) {
    const [summary, cohorts] = await Promise.all([getActivationSummary(f), getRetentionCohorts(f)]);
    return { summary, cohorts };
}

export function GET(req: Request) {
    return runMetric(req, activation);
}
