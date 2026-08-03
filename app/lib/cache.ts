// app/lib/cache.ts
import "server-only";
import { redis } from "./redis";

// ── TTL constants (seconds) ───────────────────────────────────────────────────
export const CACHE_TTL = {
  short:  60,        // 1 min  — search results, filters
  medium: 3600,      // 1 hour — package listings
  long:   86400,     // 1 day  — regions, destinations (rarely change)
} as const;

// ── Cache-key prefixes ───────────────────────────────────────────────────────
// Bump the version segment (v1 → v2) whenever a cached value's SHAPE changes;
// old entries then age out on their own instead of being deserialized into a
// type they no longer match.
export const CACHE_KEYS = {
  packageSearch: "pkgsearch:v1",
  packageFacets: "pkgfacets:v1",
  hotelSearch:   "hotelsearch:v1",
  hotelFacets:   "hotelfacets:v1",
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
  if (!redis) return null; // REDIS_URL unset — cache disabled, always a miss
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
  ttl: number = CACHE_TTL.medium
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.error("[CACHE_SET_ERROR]", err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("[CACHE_DEL_ERROR]", err);
  }
}

// ── Delete all keys matching a pattern ───────────────────────────────────────
// Used for tag-based invalidation e.g. bust all "packages:*" keys.
//
// SCAN, not KEYS: KEYS walks the whole keyspace in one blocking pass, stalling
// every other client for the duration. On a managed Redis that also bills per
// command it's the difference between a bounded cursor walk and a full scan on
// every invalidation.
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    console.error("[CACHE_DEL_PATTERN_ERROR]", err);
  }
}

// ── Cache-aside helper (read → miss → fetch → write) ─────────────────────────
// `ttl: number`, not an inferred default — inferring from CACHE_TTL.medium
// narrows the parameter to the literal 3600, so every other TTL constant is a
// type error at the call site.
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.medium
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const data = await fetcher();
  await cacheSet(key, data, ttl);
  return data;
}