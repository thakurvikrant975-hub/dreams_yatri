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
 *   enableOfflineQueue: false
 *     ioredis defaults this to true, queueing commands until a connection
 *     exists. With no server reachable the queue never drains, so `await
 *     redis.get(...)` never settles and the request hangs forever rather than
 *     falling through to the DB. Off = commands reject immediately while
 *     disconnected, which is exactly what the cache-aside path wants.
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
    connectTimeout: 1_000,
    enableOfflineQueue: false,
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
