import "server-only";
import { NextResponse } from "next/server";

/**
 * Server-side admin gate for the analytics API routes.
 *
 * The admin panel is admin-only and already verifies this on the client by
 * calling `GET /api/v1/users/me` and checking `role === "ADMIN"` (see
 * dashboard-layout.tsx). We reuse the *exact same* check server-side: the
 * browser forwards its `Authorization: Bearer <jwt>` header, and we re-validate
 * it against faction-backend before running any SQL. This means:
 *   - No new auth scheme is introduced.
 *   - The DB connection is never reachable without a valid ADMIN token.
 *   - A student token (even if valid) cannot read founder analytics.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AdminContext {
    userId: string;
    role: string;
}

type Guarded = { ok: true; ctx: AdminContext } | { ok: false; response: NextResponse };

export async function requireAdmin(req: Request): Promise<Guarded> {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth || !/^Bearer\s+.+/i.test(auth)) {
        return { ok: false, response: json(401, { error: "unauthorized", detail: "Missing bearer token." }) };
    }

    let me: { id?: string; role?: string } | null = null;
    try {
        const res = await fetch(`${API_URL}/api/v1/users/me`, {
            headers: { Authorization: auth },
            // Never cache an auth check.
            cache: "no-store",
        });
        if (!res.ok) {
            return { ok: false, response: json(401, { error: "unauthorized", detail: "Token rejected by backend." }) };
        }
        me = (await res.json()) as { id?: string; role?: string };
    } catch {
        return { ok: false, response: json(502, { error: "auth_upstream_unreachable", detail: "Could not verify session with faction-backend." }) };
    }

    if (me?.role !== "ADMIN") {
        return { ok: false, response: json(403, { error: "forbidden", detail: "Admin role required." }) };
    }
    return { ok: true, ctx: { userId: me.id ?? "", role: me.role } };
}

function json(status: number, body: unknown): NextResponse {
    return NextResponse.json(body, { status });
}
