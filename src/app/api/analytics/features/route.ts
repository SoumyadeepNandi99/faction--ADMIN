import { runMetric } from "@/lib/analytics/handler";
import {
    getContestSummary,
    getCustomTestFunnel,
    getDoubtSummary,
    getFeatureReach,
    getPotdSummary,
} from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function features(f: AnalyticsFilters) {
    const [potd, customTest, contest, doubt, reach] = await Promise.all([
        getPotdSummary(f),
        getCustomTestFunnel(f),
        getContestSummary(f),
        getDoubtSummary(f),
        getFeatureReach(f),
    ]);
    return { potd, customTest, contest, doubt, reach };
}

export function GET(req: Request) {
    return runMetric(req, features);
}
