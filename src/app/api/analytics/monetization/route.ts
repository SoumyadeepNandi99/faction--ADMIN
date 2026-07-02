import { runMetric } from "@/lib/analytics/handler";
import { getMonetizationSummary } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function monetization(f: AnalyticsFilters) {
    const summary = await getMonetizationSummary(f);
    return { summary };
}

export function GET(req: Request) {
    return runMetric(req, monetization);
}
