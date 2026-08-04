/**
 * Standalone Prisma client for tsx scripts.
 *
 * `app/lib/db.ts` can't be imported from a tsx script: it ends in a top-level
 * `await`, and tsx resolves `.ts` files under this package as CJS (the root
 * package.json has no `"type": "module"`), where TLA is a transform error. That
 * breaks every db-backed script in package.json, not just these — see the note
 * in the seed script's docstring.
 *
 * This builds an equivalent client with the same pg adapter and Neon-friendly
 * connection settings, minus the retry extension (a one-shot script that fails
 * on a cold start can simply be re-run — it's idempotent).
 */
import dns from "dns";
import net from "net";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// Same Node 22 Happy-Eyeballs workaround app/lib/db.ts applies — without it,
// Neon endpoints that don't advertise IPv6 stall on connect.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const url = new URL(process.env.DATABASE_URL!);
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: isLocal ? false : { rejectUnauthorized: false, servername: url.hostname },
    max: 5,
    connectionTimeoutMillis: 20_000,
});
pool.on("error", (err) => console.error("[db] idle client error:", err.message));

export const db = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

/** Which database this script is about to touch — printed so a production run is never a surprise. */
export const dbTarget = `${url.hostname}/${url.pathname.slice(1)}`;
