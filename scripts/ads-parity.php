<?php
/**
 * Runs dy_capture.php's detection over query strings from stdin (JSON object
 * of name → query string) and prints what it would forward, as JSON. Driven by
 * scripts/test-ads-attribution-parity.ts; not meant to be run by hand.
 *
 * Including the hook from the CLI is safe: its landing-hit job only sets a
 * cookie, and its lead job returns at once for anything but a POST.
 */
require __DIR__ . '/../integrations/dreamsyatri-com/dy_capture.php';

$in = json_decode(stream_get_contents(STDIN), true);
$out = [];
foreach ($in['urls'] as $name => $qs) {
    $a = dy_detect_attribution(ltrim($qs, '?'), '', false);
    $api = $a ? dy_attrib_to_api($a) : null;
    $ads = [];
    if ($api) foreach (DY_AD_FIELDS as $f) if ($api[$f] !== null) $ads[$f] = $api[$f];
    $out['urls'][$name] = (object) $ads;
}

// The landing hit stamps a click time; a later read does not.
$hit = dy_detect_attribution('gclid=G&campaignid=5', '', true);
$out['landingHitClickAt'] = $hit['ads']['adsClickAt'] ?? null;
$late = dy_detect_attribution('gclid=G&campaignid=5', '', false);
$out['lateReadClickAt'] = $late['ads']['adsClickAt'] ?? null;

// A cookie from before this change, and one edited by hand.
$old = dy_attrib_to_api(['channel' => 'GOOGLE_ADS', 'gclid' => 'OLD', 'source' => null, 'medium' => null]);
$out['oldCookieAds'] = array_values(array_filter(array_map(function ($f) use ($old) { return $old[$f]; }, DY_AD_FIELDS)));
$out['oldCookieGclid'] = $old['gclid'];
$forged = dy_attrib_to_api(['channel' => 'DIRECT', 'ads' => ['utmSource' => 'forged', 'adsCampaignId' => ['not', 'a', 'string'], 'adsAdGroupId' => '9']]);
$out['forgedUtm'] = $forged['utmSource'];
$out['forgedCampaign'] = $forged['adsCampaignId'];
$out['forgedAdGroup'] = $forged['adsAdGroupId'];

echo json_encode($out, JSON_UNESCAPED_SLASHES);
