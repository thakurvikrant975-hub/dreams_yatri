import "server-only";
import dns from "dns";
import net from "net";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Fix Node.js 22+ Happy Eyeballs (RFC 8305): Node 22 tries IPv6 first, which
// times out for Neon endpoints that don't advertise IPv6. Setting this once
// here is cleaner than resolving IPs manually — pg re-resolves DNS per new
// connection, so IP changes (failover, cold-start rerouting) are handled too.
dns.setDefaultResultOrder("ipv4first");

// `dns.setDefaultResultOrder` only changes which family Node *prefers* — with
// autoSelectFamily (default on since Node 18.13/20) it still races the other
// family in parallel and can surface an AggregateError across both if either
// side is slow, even when the preferred family would have connected fine on
// its own. pg calls `stream.connect(port, host)` with no options object, so
// there's no per-connection way to force a single family — this Node-level
// switch is the only lever that fully disables the dual-stack race.
net.setDefaultAutoSelectFamily(false);

function createPool() {
  const url = new URL(process.env.DATABASE_URL!);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  const pool = new Pool({
    host:     url.hostname,
    port:     parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user:     decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl:      isLocal ? false : { rejectUnauthorized: false, servername: url.hostname },
    // PgBouncer (Neon pooler) still does the real pooling against Postgres,
    // but 3 was too tight for our own side: a single page render routinely
    // fires several Prisma calls concurrently (e.g. sales-query's
    // Promise.all of 3 queries), which alone maxed out the pool — any
    // other concurrent request (even just the session's teamMember lookup)
    // then queued behind it and could exceed connectionTimeoutMillis,
    // surfacing as "Connection terminated due to connection timeout".
    max:      10,
    // 30 s keeps connections alive across typical Neon idle gaps (compute
    // stays warm for ~5 min) without leaving them open forever.
    idleTimeoutMillis:      30_000,
    // 20 s covers Neon cold-starts (3–8 s typical, up to ~15 s under load).
    connectionTimeoutMillis: 20_000,
    allowExitOnIdle:        false,
  });

  // Prevent unhandled 'error' events from crashing the process when Neon
  // terminates an idle connection server-side.
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  return pool;
}

async function createPrismaClient() {
  const pool    = createPool();
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });

  // Retry model queries that fail with a connection-drop error. This covers
  // Neon compute cold-start: the pooler accepts the TCP connection while the
  // compute wakes up, then drops it before the query runs — cold starts run
  // 3-8s typical, up to ~15s under load (see connectionTimeoutMillis above),
  // so the retry budget below is sized to actually outlast that (previously
  // 3 attempts / ~1.8s total, which gave up well before a real cold start
  // finished and surfaced as an unhandled PrismaClientInitializationError).
  // Only model operations are retried — raw queries are left to the caller.
  const RETRYABLE = /connection terminated|connection ended|econnreset|socket hang up|timeout exceeded/i;
  const MAX_ATTEMPTS = 6;
  const BACKOFF_MS = [500, 1000, 2000, 3000, 5000]; // ~11.5s total across 6 attempts

  const extended = client.$extends({
    name: "retry-on-connection-error",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              const cause = err instanceof Error && err.cause instanceof Error
                ? err.cause.message
                : "";
              const msg = (err instanceof Error ? err.message : String(err)) + " " + cause;
              const retryable = RETRYABLE.test(msg);
              if (attempt < MAX_ATTEMPTS && retryable) {
                console.warn(`[db] retrying after connection drop (attempt ${attempt}/${MAX_ATTEMPTS}):`, msg.trim());
                await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1]));
                continue;
              }
              throw err;
            }
          }
          /* istanbul ignore next */
          throw new Error("unreachable");
        },
      },
    },
  });

  // Warm the connection before handing the client out — dev-server startup
  // (or any cold boot) is exactly when the first real request is most
  // likely to race a suspended Neon compute. Same retry budget as above,
  // via a trivial raw query, so that race never reaches app code at all.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await client.$queryRaw`SELECT 1`;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS && RETRYABLE.test(msg)) {
        console.warn(`[db] warm-up retry after connection drop (attempt ${attempt}/${MAX_ATTEMPTS}):`, msg.trim());
        await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1]));
        continue;
      }
      console.error("[db] warm-up query failed, continuing anyway — first real query will retry independently:", msg);
      break;
    }
  }

  return extended;
}

type DbClient = Awaited<ReturnType<typeof createPrismaClient>>;

// Use this instead of Prisma.TransactionClient in service files — it matches
// the actual extended client's transaction type after $extends.
export type TransactionClient = Parameters<Parameters<DbClient["$transaction"]>[0]>[0];

const globalForPrisma = globalThis as unknown as {
  prisma:     DbClient | undefined;
  prismaInit: Promise<DbClient> | undefined;
};

if (!globalForPrisma.prismaInit) {
  globalForPrisma.prismaInit = createPrismaClient().then(client => {
    globalForPrisma.prisma = client;
    return client;
  });
}

export const db = await globalForPrisma.prismaInit;
