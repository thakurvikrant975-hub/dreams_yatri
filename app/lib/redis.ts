// app/lib/redis.ts
import "server-only";
import Redis from "ioredis";

const createRedisClient = () => {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
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

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}