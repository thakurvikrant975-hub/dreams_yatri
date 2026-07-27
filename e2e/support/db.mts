import "./env.mjs";
import dns from "dns/promises";
import pg from "pg";
import { PrismaClient } from "../../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

let client: PrismaClient | undefined;

async function resolveIPv4(hostname: string): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const [ip] = await dns.resolve4(hostname);
            return ip;
        } catch {
            if (attempt === 3) break;
            await new Promise((r) => setTimeout(r, 200 * attempt));
        }
    }
    const { address } = await dns.lookup(hostname, { family: 4 });
    return address;
}

/** Lazily-constructed Prisma client for E2E setup/teardown scripts.
 * Mirrors prisma/seed/pg-ipv4.ts's IPv4-resolution pool (duplicated rather
 * than imported — that file is a plain .ts consumed by the real seed
 * pipeline, and cross-importing it from an .mts module hits Node's stricter
 * ESM named-export resolution). */
export async function getDb(): Promise<PrismaClient> {
    if (!client) {
        const url = new URL(process.env.DATABASE_URL!);
        const ip = await resolveIPv4(url.hostname);
        const pool = new pg.Pool({
            host: ip,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1),
            user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password),
            ssl: { rejectUnauthorized: false, servername: url.hostname },
        });
        client = new PrismaClient({ adapter: new PrismaPg(pool) });
    }
    return client;
}
