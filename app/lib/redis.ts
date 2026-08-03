// app/lib/redis.ts
import "server-only";
import Redis from "ioredis";

/**
 * Shared Redis client for the cache layer (app/lib/cache.ts).
 *
 * The cache is an OPTIONAL accelerator: every helper in cache.ts swallows
 * errors and falls through to the database. That contract only holds if a
 * command against an unreachable Redis *rejects* — which is why the two
 * settings below matter more than they look:
 *
 *   commandTimeout, NOT enableOfflineQueue:false
 *     The offline queue must stay ON. With lazyConnect the connection is only
 *     opened by the first command, so disabling the queue rejects that command
 *     before the socket is writable — on serverless every cold start would miss
 *     the cache and log an error. The queue is what lets that first command
 *     wait for the connection it just triggered.
 *     What the queue must NOT do is wait forever, so commandTimeout bounds any
 *     single command. Together with the retryStrategy giving up after 3 tries,
 *     an unreachable Redis rejects in about a second and cache.ts's documented
 *     fall-through-to-DB path runs.
 *
 *   REDIS_URL unset ⇒ disabled
 *     Defaulting to localhost is right for dev and actively harmful in
 *     production, where nothing listens on localhost and every cached read
 *     would pay the failure path on every request.
 */

const REDIS_URL = process.env.REDIS_URL;

/** False when REDIS_URL is unset — callers skip Redis entirely rather than fail per-request. */
export const cacheEnabled = Boolean(REDIS_URL && REDIS_URL.trim() !== "");

const createRedisClient = () => {
  const client = new Redis(REDIS_URL!, {
    maxRetriesPerRequest: 1,
    // Generous enough to absorb a cold TLS handshake to a managed host (the
    // first command pays connect + handshake, not just the round trip), tight
    // enough that a wedged Redis can't hold a request open for long.
    connectTimeout: 3_000,
    commandTimeout: 3_000,
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 1000); // 200ms, 400ms, 600ms backoff
    },
    lazyConnect: true, // Don't connect until first command
  });

  client.on("error", (err) => {
    // Log but don't crash — app should work even if Redis is down
    console.error("[REDIS_ERROR]", err.message);
  });

  client.on("connect", () => {
    console.log("✅ Redis connected");
  });

  return client;
};

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis: Redis | null = cacheEnabled
  ? (globalForRedis.redis ?? createRedisClient())
  : null;

if (process.env.NODE_ENV !== "production" && redis) {
  globalForRedis.redis = redis;
}
