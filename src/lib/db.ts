import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Read-only Postgres access for the Founder Analytics dashboard.
 *
 * WHY THIS EXISTS
 * ---------------
 * The admin panel talks to `faction-backend` over its REST API for everything
 * else. The founder-analytics KPIs, however, are *aggregate* metrics (DAU/MAU,
 * retention cohorts, POTD/custom-test/doubt funnels, notification rates) that
 * the REST surface does not expose and that we are not allowed to add endpoints
 * for. So this dashboard — and ONLY this dashboard — reads the faction-backend
 * Postgres (Supabase) database directly, server-side, with a hard read-only
 * guarantee.
 *
 * SAFETY MODEL (defence in depth — the DB must never be written)
 *   1. The connection sets `default_transaction_read_only=on` at the session
 *      level, so the server refuses any write in this pool.
 *   2. `readonlyQuery()` runs every statement inside an explicit
 *      `BEGIN TRANSACTION READ ONLY … COMMIT`.
 *   3. `assertSelectOnly()` rejects any SQL whose first keyword isn't SELECT or
 *      WITH, and any text containing a statement separator, so a stray write can
 *      never even be sent.
 *   4. A `statement_timeout` bounds runaway aggregations.
 *
 * Combined, a DELETE / UPDATE / INSERT / DDL is impossible through this module.
 */

const connectionString = process.env.ANALYTICS_DATABASE_URL;

// A single pool is reused across hot-reloads/route invocations (Next.js can
// re-import modules), stashed on globalThis to avoid connection exhaustion.
const globalForPool = globalThis as unknown as { __analyticsPool?: Pool };

function getPool(): Pool {
    if (!connectionString) {
        throw new AnalyticsDbError(
            "not_configured",
            "ANALYTICS_DATABASE_URL is not set. The Founder Analytics dashboard needs a read-only Postgres connection string to the faction-backend database. See .env.local.example.",
        );
    }
    if (!globalForPool.__analyticsPool) {
        globalForPool.__analyticsPool = new Pool({
            connectionString,
            // Enforce read-only + a statement timeout for EVERY connection in the
            // pool, at the session level. `-c` options are passed to the server.
            options: "-c default_transaction_read_only=on -c statement_timeout=15000 -c idle_in_transaction_session_timeout=15000",
            max: 4, // analytics is low-QPS; keep the footprint tiny
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            // Supabase's pooler terminates SSL at the edge; require TLS but don't
            // pin the CA (matches how the mobile/back-end clients connect).
            ssl: sslForConnectionString(connectionString),
        });
        globalForPool.__analyticsPool.on("error", err => {
            // Never let an idle-client error crash the Node process.
            console.error("[analytics-db] idle client error:", err.message);
        });
    }
    return globalForPool.__analyticsPool;
}

function sslForConnectionString(cs: string): false | { rejectUnauthorized: boolean } {
    // Allow opting out for a local Postgres (e.g. sslmode=disable), otherwise
    // require TLS without CA pinning (Supabase-friendly).
    if (/sslmode=disable/.test(cs) || /localhost|127\.0\.0\.1/.test(cs)) return false;
    return { rejectUnauthorized: false };
}

export class AnalyticsDbError extends Error {
    constructor(
        public code: "not_configured" | "unsafe_query" | "query_failed",
        message: string,
    ) {
        super(message);
        this.name = "AnalyticsDbError";
    }
}

/**
 * Reject anything that isn't a single read-only statement. This is a belt to the
 * read-only-transaction braces: it stops a malformed/injected string from ever
 * reaching the server.
 */
function assertSelectOnly(sql: string): void {
    const trimmed = sql.trim();
    // First meaningful keyword must be SELECT or WITH.
    if (!/^(select|with)\b/i.test(trimmed)) {
        throw new AnalyticsDbError("unsafe_query", "Only SELECT/WITH queries are permitted on the analytics connection.");
    }
    // Forbid multiple statements. We strip a single trailing ';' first, then a
    // ';' anywhere else means a second statement was appended.
    const withoutTrailing = trimmed.replace(/;\s*$/, "");
    if (withoutTrailing.includes(";")) {
        throw new AnalyticsDbError("unsafe_query", "Multiple statements are not permitted on the analytics connection.");
    }
}

/**
 * Run a parameterised read-only query. Params use $1, $2, … placeholders — never
 * string-interpolate values into the SQL.
 */
export async function readonlyQuery<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
): Promise<T[]> {
    assertSelectOnly(sql);
    const pool = getPool();
    let client: PoolClient | undefined;
    try {
        client = await pool.connect();
        await client.query("BEGIN TRANSACTION READ ONLY");
        const res = await client.query<T>(sql, params);
        await client.query("COMMIT");
        return res.rows;
    } catch (err) {
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch {
                /* connection already broken — nothing to roll back */
            }
        }
        if (err instanceof AnalyticsDbError) throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw new AnalyticsDbError("query_failed", message);
    } finally {
        client?.release();
    }
}

/** Convenience: run a query expected to return exactly one row. */
export async function readonlyQueryOne<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
): Promise<T | null> {
    const rows = await readonlyQuery<T>(sql, params);
    return rows[0] ?? null;
}

export function isDbConfigured(): boolean {
    return Boolean(connectionString);
}
