import "server-only";
import { redis } from "./redis";

/**
 * Fixed-window rate limiter backed by Redis. Fails OPEN if Redis is
 * unreachable — matches this app's existing Redis resilience stance
 * (app must keep working if Redis is down); a brief unlimited window
 * during a Redis outage is a much smaller risk than login/signup being
 * unusable because of an infra blip.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    console.error("[rate-limit] Redis error, failing open:", err);
    return { allowed: true, remaining: limit };
  }
}
