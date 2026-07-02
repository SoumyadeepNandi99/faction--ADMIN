import { runMetric } from "@/lib/analytics/handler";
import { getClasses } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
    return runMetric(req, async () => ({ classes: await getClasses() }));
}
