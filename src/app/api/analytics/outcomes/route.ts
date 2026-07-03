import { runMetric } from "@/lib/analytics/handler";
import { getLearningOutcomes, getSolvedByExam, getSolvedBySubject, getSolvedTrend } from "@/lib/analytics/queries";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function outcomes(f: AnalyticsFilters) {
    const [summary, bySubject, byExam, trend] = await Promise.all([
        getLearningOutcomes(f),
        getSolvedBySubject(f),
        getSolvedByExam(f),
        getSolvedTrend(f),
    ]);
    return { summary, bySubject, byExam, trend };
}

export function GET(req: Request) {
    return runMetric(req, outcomes);
}
