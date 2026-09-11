/**
 * Ad attribution, from landing URL to package_queries columns.
 *
 * Everything short of the database: the parser both sites' readers share, the
 * pageUrl fallback intake uses, the column mapping, and the rule that matters
 * most — a malformed attribution field is dropped, never a reason to lose the
 * lead it arrived with. See docs/ads-analytics/ads-analytics-plan.md, Step 1.
 */
import {
  readAdAttribution, searchOf, attributionFor, leadAdColumns, pickAdClick,
} from "../app/lib/ads/attribution";
import { enquirySchema } from "../app/actions/enquiry/schema";
import { externalLeadSchema } from "../app/api/leads/external/schema";

let failures = 0;
/** Key order is not the point of any of these, so it is not compared. */
const stable = (v: unknown): unknown =>
  v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]))
    : v;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(stable(got)) === JSON.stringify(stable(want));
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (expected ${JSON.stringify(want)})`}`);
}

const CLICKED = new Date("2026-09-11T10:00:00.000Z");
const NOW = new Date("2026-09-11T10:05:00.000Z");
const LEAD = { name: "Riya Sharma", phone: "+919876543210" };

/** What Google produces from the Step 1d suffix on a Search click. */
const SEARCH_CLICK =
  "?gclid=EAIaTEST123&campaignid=21436587&adgroupid=16273849506&creative=701234567890" +
  "&keyword=kerala+packages&matchtype=e&network=g&device=m&targetid=kwd-301234567" +
  "&utm_source=google&utm_medium=cpc";

console.log("reading a landing URL:");
check("a Search click, every field", readAdAttribution(SEARCH_CLICK, CLICKED), {
  adsClickId: "EAIaTEST123", adsClickIdType: "GCLID",
  adsCampaignId: "21436587", adsAdGroupId: "16273849506", adsCreativeId: "701234567890",
  adsKeyword: "kerala packages", adsMatchType: "e", adsNetwork: "g", adsDevice: "m",
  adsTargetId: "kwd-301234567", utmSource: "google", utmMedium: "cpc",
  adsClickAt: "2026-09-11T10:00:00.000Z",
});
check("PMax: unfilled and blank placeholders are dropped",
  readAdAttribution("?gclid=X&campaignid=111&adgroupid={adgroupid}&keyword=&network=x"),
  { adsClickId: "X", adsClickIdType: "GCLID", adsCampaignId: "111", adsNetwork: "x" });
check("iOS web-to-app click keeps its type", readAdAttribution("?gbraid=0AAAAB&campaignid=5"),
  { adsClickId: "0AAAAB", adsClickIdType: "GBRAID", adsCampaignId: "5" });
check("gclid wins over wbraid, as in dy_capture.php", readAdAttribution("?wbraid=W1&gclid=G1"),
  { adsClickId: "G1", adsClickIdType: "GCLID" });
check("utm alone is attribution but not an ad click — no click time",
  readAdAttribution("?utm_source=newsletter&utm_medium=email", CLICKED),
  { utmSource: "newsletter", utmMedium: "email" });
check("no evidence is null, not an empty object", readAdAttribution("?foo=bar"), null);
check("an empty string too", readAdAttribution(""), null);
check("a blank click id is no click id", readAdAttribution("?gclid=%20%20"), null);
check("without a witnessed landing, no click time", readAdAttribution("?gclid=G")?.adsClickAt, undefined);

console.log("\nthe query string of a pageUrl:");
check("a real URL", searchOf("https://dreamsyatri.in/offers/kerala?gclid=abc"), "?gclid=abc");
check("no query", searchOf("https://dreamsyatri.in/offers/kerala"), "");
check("not a URL", searchOf("kerala packages"), "");
check("nothing", searchOf(undefined), "");

console.log("\nwhat a lead is written with:");
check("the caller's own ad wins over its pageUrl",
  attributionFor({ adsClickId: "FROM_FORM", adsClickIdType: "GCLID" }, "https://x.in/p?gclid=FROM_URL&campaignid=9"),
  { adsClickId: "FROM_FORM", adsClickIdType: "GCLID" });
check("an old bundle that sent nothing falls back to its landing URL",
  attributionFor({}, "https://dreamsyatri.in/packages/kerala?gclid=G1&campaignid=77&adgroupid=88"),
  { adsClickId: "G1", adsClickIdType: "GCLID", adsCampaignId: "77", adsAdGroupId: "88" });
check("the .com bridge's utm mapping survives the URL's",
  attributionFor(
    { utmSource: "google", utmMedium: "cpc", utmCampaign: undefined },
    "https://dreamsyatri.com/kerala-packages/?gclid=G2&campaignid=5&utm_source=other",
  ),
  { adsClickId: "G2", adsClickIdType: "GCLID", adsCampaignId: "5", utmSource: "google", utmMedium: "cpc" });
check("nothing anywhere leaves it as sent", attributionFor({ utmSource: "direct" }, "https://x.in/p"),
  { utmSource: "direct" });
check("an unparseable pageUrl too", attributionFor({}, "not a url"), {});

console.log("\nthe columns:");
const full = leadAdColumns({ ...readAdAttribution(SEARCH_CLICK, CLICKED)! }, NOW);
check("a Google click is a Google lead", full.adsPlatform, "GOOGLE");
check("the old gclid column is filled from the click id", full.gclid, "EAIaTEST123");
check("click time survives as a Date", full.adsClickAt?.toISOString(), "2026-09-11T10:00:00.000Z");
check("a caller's own gclid is not overwritten",
  leadAdColumns({ gclid: "LEGACY", adsClickId: "NEW", adsClickIdType: "GBRAID" }, NOW).gclid, "LEGACY");
check("a campaign id with no click id still means Google",
  leadAdColumns({ adsCampaignId: "5" }, NOW).adsPlatform, "GOOGLE");
check("utm alone is no platform and no gclid",
  [leadAdColumns({}, NOW).adsPlatform, leadAdColumns({}, NOW).gclid], [null, null]);
check("a click from tomorrow is dropped",
  leadAdColumns({ adsClickId: "G", adsClickAt: "2026-09-12T10:00:00.000Z" }, NOW).adsClickAt, null);
check("a fast clock within the hour is not",
  leadAdColumns({ adsClickId: "G", adsClickAt: "2026-09-11T10:30:00.000Z" }, NOW).adsClickAt?.toISOString(),
  "2026-09-11T10:30:00.000Z");
check("an unparseable click time is dropped",
  leadAdColumns({ adsClickId: "G", adsClickAt: "yesterday" }, NOW).adsClickAt, null);
check("a click id type with no id is noise",
  leadAdColumns({ adsClickIdType: "WBRAID" }, NOW).adsClickIdType, null);

console.log("\nattribution never costs a lead — the website's forms:");
const junk = enquirySchema.safeParse({
  ...LEAD,
  adsClickId: "G", adsKeyword: "  kerala  ",
  adsClickIdType: "BOGUS", adsCampaignId: "x".repeat(500), adsClickAt: "yesterday",
});
check("junk attribution still parses", junk.success, true);
check("…with only the junk dropped",
  junk.success && [junk.data.adsClickId, junk.data.adsKeyword, junk.data.adsClickIdType, junk.data.adsCampaignId, junk.data.adsClickAt],
  ["G", "kerala", undefined, undefined, undefined]);
check("a lead with none at all is unaffected", enquirySchema.safeParse(LEAD).success, true);

console.log("\n…and the .com bridge:");
const blanks = externalLeadSchema.safeParse({
  ...LEAD, adsClickId: "", adsClickIdType: "", adsCampaignId: "", adsClickAt: "",
});
check("PHP's blank strings parse", blanks.success, true);
check("…as absent", blanks.success && pickAdClick(blanks.data), {});
const good = externalLeadSchema.safeParse({
  ...LEAD, adsClickId: "W9", adsClickIdType: "WBRAID", adsCampaignId: "123",
  adsClickAt: "2026-09-11T15:30:00+05:30",
});
check("real values carry through",
  good.success && pickAdClick(good.data),
  { adsClickId: "W9", adsClickIdType: "WBRAID", adsCampaignId: "123", adsClickAt: "2026-09-11T15:30:00+05:30" });

console.log("\nthe whole path, browser to row:");
// Captured on landing, round-tripped through localStorage, submitted with the
// form, validated by the server action, then written by intake.
const stored = JSON.parse(JSON.stringify(readAdAttribution(SEARCH_CLICK, CLICKED)));
const submitted = enquirySchema.safeParse({ ...LEAD, source: "LANDING_PAGE", ...stored });
check("the form's payload validates", submitted.success, true);
if (submitted.success) {
  const d = submitted.data;
  const written = leadAdColumns(
    { ...attributionFor({ ...pickAdClick(d), utmSource: d.utmSource }, "https://dreamsyatri.in/offers/kerala") },
    NOW,
  );
  check("lands on the row as the ad that produced it",
    [written.adsPlatform, written.adsCampaignId, written.adsAdGroupId, written.adsKeyword, written.adsClickIdType, written.gclid],
    ["GOOGLE", "21436587", "16273849506", "kerala packages", "GCLID", "EAIaTEST123"]);
}

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
