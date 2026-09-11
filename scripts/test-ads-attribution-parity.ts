/**
 * The .com hook and the .in parser must read a landing URL the same way —
 * otherwise the same ad produces different columns depending on which site
 * took the lead, and the report splits one campaign in two.
 *
 * Runs the real dy_capture.php under the local PHP CLI (via ads-parity.php) and
 * compares it with readAdAttribution. Needs `php` on the PATH, which is why it
 * is not part of `npm test`.
 */
import { spawnSync } from "node:child_process";
import { readAdAttribution, pickAdClick } from "../app/lib/ads/attribution";
import { externalLeadSchema } from "../app/api/leads/external/schema";

let failures = 0;
const stable = (v: unknown): unknown =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]))
    : v;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(stable(got)) === JSON.stringify(stable(want));
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

const URLS: Record<string, string> = {
  "a Search click": "?gclid=EAIaTEST123&campaignid=21436587&adgroupid=16273849506&creative=701234567890&keyword=kerala+packages&matchtype=e&network=g&device=m&targetid=kwd-301234567",
  "PMax placeholders": "?gclid=X&campaignid=111&adgroupid={adgroupid}&keyword=&network=x",
  "a literal {campaignid}": "?gclid=X&campaignid={campaignid}",
  "an iOS gbraid": "?gbraid=0AAAAB&campaignid=5",
  "gclid beats wbraid": "?wbraid=W1&gclid=G1",
  "percent- and plus-encoded keyword": "?gclid=G&keyword=kerala%20honeymoon+packages",
  "a blank click id": "?gclid=%20%20&campaignid=7",
  "utm tags alone": "?utm_source=newsletter&utm_medium=email",
  "nothing at all": "?foo=bar",
};

let php: {
  urls: Record<string, Record<string, string>>;
  landingHitClickAt: string | null; lateReadClickAt: string | null;
  oldCookieAds: string[]; oldCookieGclid: string | null;
  forgedUtm: string | null; forgedCampaign: string | null; forgedAdGroup: string | null;
};
// Warnings to stderr so stdout stays JSON — and any at all is a failure: the
// hook runs ahead of every page on the .com site, and must never print.
const run = spawnSync("php", ["-n", "-d", "display_errors=stderr", "-d", "error_reporting=-1", "scripts/ads-parity.php"], {
  input: JSON.stringify({ urls: URLS }), encoding: "utf8",
});
if (run.error || run.status !== 0) {
  console.error("could not run the PHP side — is `php` installed?\n", run.error ?? run.stderr);
  process.exit(1);
}
try {
  php = JSON.parse(run.stdout);
} catch {
  console.error("the PHP side printed something other than JSON:\n", run.stdout);
  process.exit(1);
}

console.log("the hook itself:");
check("prints no warnings or notices", run.stderr.trim(), "");

console.log("\nthe same URL, both sites:");
for (const [name, qs] of Object.entries(URLS)) {
  check(name, php.urls[name], pickAdClick(readAdAttribution(qs) ?? {}));
}

console.log("\nclick time:");
check("stamped on the landing hit", typeof php.landingHitClickAt === "string", true);
check("…in a shape the API accepts",
  externalLeadSchema.safeParse({ name: "Riya Sharma", phone: "+919876543210", adsClickAt: php.landingHitClickAt }).data?.adsClickAt,
  php.landingHitClickAt);
check("not stamped when read back later off a referrer", php.lateReadClickAt, null);

console.log("\ncookies already out there:");
check("one from before this change forwards no ad fields", php.oldCookieAds, []);
check("…and still its gclid", php.oldCookieGclid, "OLD");
check("a forged 'ads' key can't reach utmSource", php.forgedUtm, "direct");
check("…nor smuggle a non-string", php.forgedCampaign, null);
check("…while a real field still reads", php.forgedAdGroup, "9");

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
