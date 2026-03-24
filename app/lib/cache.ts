// app/lib/cache.ts
import "server-only";
import { redis } from "./redis";

// ── TTL constants (seconds) ───────────────────────────────────────────────────
export const CACHE_TTL = {
  short:  60,        // 1 min  — search results, filters
  medium: 3600,      // 1 hour — package listings
  long:   86400,     // 1 day  — regions, destinations (rarely change)
} as const;

// ── Cache tag registry ────────────────────────────────────────────────────────
export const CACHE_TAGS = {
  packages:     "packages",
  destinations: "destinations",
  regions:      "regions",
  package:      (slug: string) => `package:${slug}`,
  destination:  (slug: string) => `destination:${slug}`,
} as const;

// ── Core get/set with automatic JSON serialization ────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null; // Cache miss on error — fall through to DB
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttl = CACHE_TTL.medium
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.error("[CACHE_SET_ERROR]", err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("[CACHE_DEL_ERROR]", err);
  }
}

// ── Delete all keys matching a pattern ───────────────────────────────────────
// Used for tag-based invalidation e.g. bust all "packages:*" keys
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("[CACHE_DEL_PATTERN_ERROR]", err);
  }
}

// ── Cache-aside helper (read → miss → fetch → write) ─────────────────────────
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = CACHE_TTL.medium
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const data = await fetcher();
  await cacheSet(key, data, ttl);
  return data;
}