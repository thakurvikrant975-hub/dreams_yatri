import "server-only";
import dns from "dns/promises";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Resolve hostname to IPv4 only, bypassing Node.js 22 Happy Eyeballs which
// tries IPv6 (present in Neon DNS after Launch plan upgrade) and times out.
// Retries up to 3 times with fallback to dns.lookup({ family: 4 }).
async function resolveIPv4(hostname: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const [ip] = await dns.resolve4(hostname);
      return ip;
    } catch {
      if (attempt === 3) break;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  // Fallback: use OS resolver forcing IPv4
  const { address } = await dns.lookup(hostname, { family: 4 });
  return address;
}

async function createPrismaClient() {
  const url = new URL(process.env.DATABASE_URL!);
  const ip = await resolveIPv4(url.hostname);

  const pool = new Pool({
    host: ip,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false, servername: url.hostname },
    // PgBouncer (Neon pooler) handles real connection pooling — keep our pool small.
    max: 3,
    // Evict idle connections after 3s so Neon never gets the chance to terminate
    // them silently (Neon's server-side idle timeout is ~300s on the pooler).
    idleTimeoutMillis: 3000,
    // Neon compute cold-starts take 3–8s on first request.
    connectionTimeoutMillis: 15000,
  });

  // Without this handler, a connection terminated by Neon while idle in the pool
  // would emit an unhandled 'error' event and crash the process.
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

type DbClient = Awaited<ReturnType<typeof createPrismaClient>>;

const globalForPrisma = globalThis as unknown as {
  prisma: DbClient | undefined;
  prismaInit: Promise<DbClient> | undefined;
};

if (!globalForPrisma.prismaInit) {
  globalForPrisma.prismaInit = createPrismaClient().then(client => {
    globalForPrisma.prisma = client;
    return client;
  });
}

export const db = await globalForPrisma.prismaInit;
