/**
 * getImageUrl's contract — in particular what it does when
 * NEXT_PUBLIC_R2_PUBLIC_URL is missing.
 *
 * It runs while prerendering every package page, so a throw here fails the
 * whole build rather than one image: on 2026-09-12 a preview deploy died on
 * "Cannot read properties of undefined (reading 'includes')" for all 758
 * pages, because the Preview copy of that variable was scoped to one git
 * branch and every other branch got nothing.
 */
import { getImageUrl, IMAGE_SIZES } from "../app/lib/imageUrl";

let failures = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}
/** process.env only takes plain assignment, so NODE_ENV is set through a
 * widened view of it rather than defineProperty. */
const env = process.env as Record<string, string | undefined>;
const withEnv = <T>(base: string | undefined, nodeEnv: string, run: () => T): T => {
  const previous = { base: env.NEXT_PUBLIC_R2_PUBLIC_URL, nodeEnv: env.NODE_ENV };
  const set = (b: string | undefined, n: string | undefined) => {
    if (b === undefined) delete env.NEXT_PUBLIC_R2_PUBLIC_URL; else env.NEXT_PUBLIC_R2_PUBLIC_URL = b;
    if (n === undefined) delete env.NODE_ENV; else env.NODE_ENV = n;
  };
  set(base, nodeEnv);
  try { return run(); } finally { set(previous.base, previous.nodeEnv); }
};

const CDN = "https://cdn.dreamsyatri.com";

console.log("with the variable missing — a deployment fault, not a build-ender:");
check("no throw, no image", withEnv(undefined, "production", () => getImageUrl("packages/kashmir.jpg", IMAGE_SIZES.card)), "");
check("an external URL still passes through",
  withEnv(undefined, "production", () => getImageUrl("https://images.unsplash.com/photo-1.jpg")), "https://images.unsplash.com/photo-1.jpg");
check("set to empty counts as missing too", withEnv("", "production", () => getImageUrl("a.jpg")), "");

console.log("\nwith it set, behaviour is unchanged:");
check("a CF-proxied domain transforms",
  withEnv(CDN, "production", () => getImageUrl("packages/kashmir.jpg", { width: 400, quality: 75 })),
  `${CDN}/cdn-cgi/image/width=400,quality=75,fit=cover,format=auto/packages/kashmir.jpg`);
check("an r2.dev URL serves raw",
  withEnv("https://pub-abc.r2.dev", "production", () => getImageUrl("packages/kashmir.jpg", IMAGE_SIZES.card)),
  "https://pub-abc.r2.dev/packages/kashmir.jpg");
check("development serves raw as well",
  withEnv(CDN, "development", () => getImageUrl("packages/kashmir.jpg", IMAGE_SIZES.card)), `${CDN}/packages/kashmir.jpg`);
check("an empty key is still nothing", withEnv(CDN, "production", () => getImageUrl("")), "");
check("an external URL is never rewritten",
  withEnv(CDN, "production", () => getImageUrl("http://example.com/a.jpg", IMAGE_SIZES.hero)), "http://example.com/a.jpg");

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
