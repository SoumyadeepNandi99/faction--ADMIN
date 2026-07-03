import { runMetric } from "@/lib/analytics/handler";
import { getLearningOutcomes } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function outcomes(f: AnalyticsFilters) {
    const summary = await getLearningOutcomes(f);
    return { summary };
}

export function GET(req: Request) {
    return runMetric(req, outcomes);
}
