<?php
/**
 * Lead capture and traffic attribution for dreamsyatri.com.
 *
 * Wired in as PHP's auto_prepend_file, so it runs before every request without
 * a single existing file being edited. That is the whole point: these landing
 * pages are ranked and are the destination of live ad campaigns, so their URLs,
 * their markup and their existing email flow all have to stay exactly as they
 * are. This adds a second, silent copy of each lead into the Neon database the
 * dashboard reads. Nothing it does can change what the visitor sees.
 *
 * Two jobs, in order:
 *   1. On EVERY request — remember how this visitor arrived (Google ad, Meta
 *      ad, organic search, direct). Cheap, and it must happen on the landing
 *      hit because that is the only moment the click id exists.
 *   2. On lead POSTs only — forward the lead to the API.
 *
 * THE CARDINAL RULE: this runs on every request, so it must never break one.
 * It emits nothing, throws nothing, and does its network call after the
 * response has already gone out. If it fails entirely, the visitor still gets
 * their thank-you page and the team still gets the email — the lead is just
 * missing from Neon, which is where things stand today anyway.
 */

if (!defined('DY_ATTRIB_COOKIE')) {

define('DY_ATTRIB_COOKIE', 'dy_attrib');
define('DY_ATTRIB_TTL', 60 * 60 * 24 * 30); // 30 days

/**
 * How the visitor got here, from the URL and the referrer.
 *
 * The click ids are the reliable part. Google Ads auto-tagging appends `gclid`
 * and does NOT append utm parameters — which is exactly why the existing
 * script.js, which reads only utm_source, has recorded an empty source for
 * every lead it has ever captured. `fbclid` is the Meta equivalent, but it is
 * added to ANY link clicked from Facebook or Instagram, paid or not, so it
 * proves the visitor came from Meta, not that an ad was paid for — the two are
 * reported separately rather than pretending otherwise.
 */
function dy_detect_attribution($query, $referer)
{
    $q = [];
    if (is_string($query) && $query !== '') parse_str($query, $q);

    $get = function ($k) use ($q) {
        return isset($q[$k]) && is_string($q[$k]) && trim($q[$k]) !== '' ? trim($q[$k]) : null;
    };

    $gclid  = $get('gclid') ?: $get('gbraid') ?: $get('wbraid');
    $fbclid = $get('fbclid');
    $msclkid = $get('msclkid');
    $utmSource   = $get('utm_source');
    $utmMedium   = $get('utm_medium');
    $utmCampaign = $get('utm_campaign');

    $refHost = '';
    if (is_string($referer) && $referer !== '') {
        $h = parse_url($referer, PHP_URL_HOST);
        if (is_string($h)) $refHost = strtolower($h);
    }

    $paidMedium = $utmMedium !== null
        && preg_match('/^(cpc|ppc|paid|paidsocial|paid_social|display|cpm)/i', $utmMedium);

    // Most specific evidence first.
    if ($gclid !== null) {
        $channel = 'GOOGLE_ADS';
    } elseif ($msclkid !== null) {
        $channel = 'BING_ADS';
    } elseif ($fbclid !== null || preg_match('/(facebook|instagram)\./', $refHost)) {
        // Paid only when the campaign tagging says so; a share or a bio link
        // carries an fbclid too.
        $paid = $paidMedium || ($utmSource !== null && preg_match('/facebook|instagram|meta/i', $utmSource));
        // Which Meta surface, so the report can tell the two apart — they are
        // bought separately and one may be carrying the other.
        $isInsta = preg_match('/instagram/', $refHost)
            || ($utmSource !== null && preg_match('/instagram/i', $utmSource));
        $channel = $paid
            ? ($isInsta ? 'INSTAGRAM_ADS' : 'META_ADS')
            : ($isInsta ? 'INSTAGRAM_ORGANIC' : 'META_ORGANIC');
    } elseif ($utmSource !== null && preg_match('/google/i', $utmSource)) {
        $channel = $paidMedium ? 'GOOGLE_ADS' : 'SEARCH_ORGANIC';
    } elseif ($utmSource !== null) {
        $channel = $paidMedium ? 'OTHER_PAID' : 'OTHER_REFERRAL';
    } elseif (preg_match('/(google|bing|duckduckgo|yahoo)\./', $refHost)) {
        $channel = 'SEARCH_ORGANIC';
    } elseif ($refHost !== '' && strpos($refHost, 'dreamsyatri.') === false) {
        $channel = 'OTHER_REFERRAL';
    } elseif ($refHost === '') {
        $channel = 'DIRECT';
    } else {
        return null; // internal navigation tells us nothing new
    }

    return [
        'channel'  => $channel,
        'gclid'    => $gclid,
        'fbclid'   => $fbclid,
        'source'   => $utmSource,
        'medium'   => $utmMedium,
        'campaign' => $utmCampaign,
        'referrer' => is_string($referer) ? substr($referer, 0, 400) : null,
        'at'       => time(),
    ];
}

/**
 * What the dashboard should show. The lead report groups by utmSource and
 * treats a gclid as proof of Google, so these map onto the vocabulary it
 * already understands rather than inventing a parallel one.
 */
function dy_attrib_to_api($a)
{
    $map = [
        'GOOGLE_ADS'     => ['google',    'cpc'],
        'BING_ADS'       => ['bing',      'cpc'],
        'META_ADS'          => ['facebook',  'paid-social'],
        'META_ORGANIC'      => ['facebook',  'social'],
        'INSTAGRAM_ADS'     => ['instagram', 'paid-social'],
        'INSTAGRAM_ORGANIC' => ['instagram', 'social'],
        'SEARCH_ORGANIC'    => ['organic',   'organic'],
        'OTHER_PAID'     => [null,        null],
        'OTHER_REFERRAL' => [null,        'referral'],
        'DIRECT'         => ['direct',    'none'],
    ];
    $ch = isset($a['channel']) ? $a['channel'] : 'DIRECT';
    $pair = isset($map[$ch]) ? $map[$ch] : [null, null];
    return [
        'utmSource'   => $a['source']   ?: $pair[0],
        'utmMedium'   => $a['medium']   ?: $pair[1],
        'utmCampaign' => isset($a['campaign']) ? $a['campaign'] : null,
        'gclid'       => isset($a['gclid']) ? $a['gclid'] : null,
    ];
}

// ── Job 1: remember the arrival, on every request ───────────────────────────
// First touch wins: the ad that earned the visit keeps the credit even if they
// wander the site before filling the form in.
if (!isset($_COOKIE[DY_ATTRIB_COOKIE]) && !headers_sent()) {
    $seen = dy_detect_attribution(
        isset($_SERVER['QUERY_STRING']) ? $_SERVER['QUERY_STRING'] : '',
        isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : ''
    );
    if ($seen !== null) {
        @setcookie(DY_ATTRIB_COOKIE, json_encode($seen), [
            'expires'  => time() + DY_ATTRIB_TTL,
            'path'     => '/',
            'secure'   => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE[DY_ATTRIB_COOKIE] = json_encode($seen); // usable within this request
    }
}

/** Which destination a landing page is about, from its URL.
 *
 * The forms ask for a *package* ("Munnar & Tea Gardens – 2N/3D"), and most do
 * not ask for a destination at all — but the lead report groups by
 * destination, so a lead without one lands under "Not specified". The
 * directory name is the one thing every landing page reliably has.
 *
 * Suffix-stripping rather than a fixed list of all 81 folders, so a new
 * /kerala-monsoon-packages/ resolves to Kerala on its own instead of going
 * unattributed until someone remembers to update a map.
 */
function dy_destination_from_path($path)
{
    $path = strtolower((string) $path);
    $path = strtok($path, '?');

    $segment = '';
    foreach (explode('/', trim($path, '/')) as $part) {
        if ($part === '' || substr($part, -4) === '.php' || substr($part, -5) === '.html') continue;
        $segment = $part;
        break;
    }
    if ($segment === '') return null;

    // Looped, not a single pass: "gir-lion-safari-packages" carries two of
    // these and one pass would leave "gir-lion-safari" as its own destination.
    $suffixes = '/-(tour-packages|tour-package|packages|package|tours|tour|honeymoon|family|group|couples|couple|trekking|trekkingcaving|bike|safari|scuba-diving|ship|darjeeling|mice|and-families|\d+)$/';
    for ($i = 0; $i < 5; $i++) {
        $stripped = preg_replace($suffixes, '', $segment);
        $stripped = preg_replace('/-\d+$/', '', $stripped);
        if ($stripped === $segment || $stripped === '') break;
        $segment = $stripped;
    }

    // The ones a rule cannot reach: misspellings, and pages named after a town
    // rather than the state that gets reported on.
    $alias = [
        'gujrat' => 'Gujarat', 'rann-of-kutch' => 'Gujarat', 'gir-lion' => 'Gujarat',
        'uttrakhand' => 'Uttarakhand', 'chardham' => 'Uttarakhand',
        'sevensisters' => 'North East',
        'himachallandingpage' => 'Himachal', 'manali' => 'Himachal',
        'shimla' => 'Himachal', 'kasol' => 'Himachal', 'jibhi' => 'Himachal',
        'kinnaur' => 'Himachal', 'dalhousie' => 'Himachal', 'kasauli' => 'Himachal',
        'dharamshala' => 'Himachal', 'dharamshala-dalhousie' => 'Himachal',
        'uttar-pradesh' => 'Uttar Pradesh', 'up-pilgrimage' => 'Uttar Pradesh',
        'orchha' => 'Madhya Pradesh', 'madhya-pradesh' => 'Madhya Pradesh',
        'couples-honeymoon-goa' => 'Goa',
        'jaisalmer-desert' => 'Rajasthan', 'udaipur' => 'Rajasthan',
        'amarnath' => 'Kashmir', 'lonawala' => 'Lonavala',
        'north-pilgrimage' => 'Pilgrimage', 'south-pilgrimage' => 'Pilgrimage',
        'west-pilgrimage' => 'Pilgrimage',
    ];
    if (isset($alias[$segment])) return $alias[$segment];

    if (in_array($segment, ['offers', 'reporting', 'thanks', 'assets', 'build', 'googleadsreport'], true)) return null;

    // Collapse to the destination the report groups by: without this,
    // /goa-luxury-tour-packages/ and /goa-mice-packages/ each become their own
    // row and "Goa", "Goa Luxury", "Goa Mice" read as three places.
    $canonical = [
        'andaman' => 'Andaman', 'lakshadweep' => 'Lakshadweep', 'kerala' => 'Kerala',
        'goa' => 'Goa', 'spiti' => 'Spiti', 'sikkim' => 'Sikkim',
        'meghalaya' => 'Meghalaya', 'rajasthan' => 'Rajasthan', 'himachal' => 'Himachal',
        'uttarakhand' => 'Uttarakhand', 'kashmir' => 'Kashmir', 'ladakh' => 'Ladakh',
        'karnataka' => 'Karnataka', 'gujarat' => 'Gujarat', 'nepal' => 'Nepal',
        'thailand' => 'Thailand', 'dubai' => 'Dubai', 'pondicherry' => 'Pondicherry',
        'vizag' => 'Vizag', 'jaisalmer' => 'Rajasthan', 'jaipur' => 'Rajasthan',
    ];
    uksort($canonical, function ($a, $b) { return strlen($b) - strlen($a); });
    foreach ($canonical as $slug => $label) {
        if ($segment === $slug
            || strpos($segment, $slug . '-') === 0
            || substr($segment, -strlen('-' . $slug)) === '-' . $slug
            || strpos($segment, '-' . $slug . '-') !== false) {
            return $label;
        }
    }

    return ucwords(str_replace('-', ' ', $segment));
}

} // end one-time definitions

// ── Job 2: forward the lead ─────────────────────────────────────────────────

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return;

/*
 * Two generations of form live on this site and they share nothing:
 *   gen 1 (36 pages) posts contact_submit to mail.php / index.php
 *   gen 2 (43 pages) fetch()es to submit-form.php with no such field
 * Keying on contact_submit alone would silently capture only the older half.
 */
$dyScript = basename($_SERVER['SCRIPT_NAME'] ?? '');
if (!isset($_POST['contact_submit']) && $dyScript !== 'submit-form.php') return;

// Gen 2's honeypot. Its own handler drops these silently, and forwarding what
// it rejects would fill the sales queue with bots.
if (!empty($_POST['hp_field_x1'])) return;

register_shutdown_function(function () {
    try {
        // Close the connection first where the SAPI allows, so the API call
        // cannot hold the visitor's browser open.
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();

        $base = __DIR__;
        if (!is_readable("$base/dy_config.php") || !is_readable("$base/dy_lead_sync.php")) return;
        require_once "$base/dy_config.php";
        require_once "$base/dy_lead_sync.php";

        $post = $_POST;
        $name  = trim((string) ($post['name'] ?? ''));
        $phone = trim((string) ($post['phone'] ?? $post['mobile'] ?? $post['mobile_number'] ?? ''));
        if ($name === '' || $phone === '') return;

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
        $referer    = (string) ($_SERVER['HTTP_REFERER'] ?? '');

        /*
         * Where attribution comes from, best evidence first.
         *
         * The cookie is set on the landing hit, but 49 of the 81 landing pages
         * are static .html, so PHP never runs on their page view and no cookie
         * is ever set for them. For those, the referrer of this POST *is* the
         * landing URL — click id and all — which is why it is a first-class
         * source here and not a last resort.
         */
        $attrib = null;
        if (!empty($_COOKIE[DY_ATTRIB_COOKIE])) {
            $decoded = json_decode($_COOKIE[DY_ATTRIB_COOKIE], true);
            if (is_array($decoded) && isset($decoded['channel'])) $attrib = $decoded;
        }
        if ($attrib === null && $referer !== '') {
            $attrib = dy_detect_attribution((string) parse_url($referer, PHP_URL_QUERY), $referer);
        }
        if ($attrib === null) {
            $attrib = dy_detect_attribution($_SERVER['QUERY_STRING'] ?? '', $referer);
        }
        if ($attrib === null) $attrib = ['channel' => 'DIRECT'];

        $api = dy_attrib_to_api($attrib);

        // Gen 2 fills these from the query string in its own JS. Empty in
        // practice (Google sends gclid, not utm), but if a campaign is ever
        // manually tagged, what the page captured beats what we inferred.
        if (!empty($post['utm_source']))   $api['utmSource']   = trim($post['utm_source']);
        if (!empty($post['utm_medium']))   $api['utmMedium']   = trim($post['utm_medium']);
        if (!empty($post['utm_campaign'])) $api['utmCampaign'] = trim($post['utm_campaign']);

        // Which landing page. Gen 2 posts page_url; otherwise the referrer for
        // a fetch()ed handler, or this request's own path for gen 1.
        $landing = trim((string) ($post['page_url'] ?? ''));
        if ($landing === '') $landing = $referer !== '' ? $referer : 'https://dreamsyatri.com' . $requestUri;

        $destPath = parse_url($landing, PHP_URL_PATH);
        $destination = dy_destination_from_path($destPath);
        if ($destination === null) $destination = dy_destination_from_path($requestUri);

        // gen 1 calls the package select "destination"; gen 2 calls it "package".
        $picked = trim((string) ($post['package'] ?? $post['destination'] ?? ''));

        $result = dy_sync_lead([
            'name'                => $name,
            'phone'               => $phone,
            'email'               => trim((string) ($post['email'] ?? '')),
            'persons'             => $post['persons'] ?? $post['travelers'] ?? $post['travellers'] ?? $post['pax'] ?? null,
            'city'                => trim((string) ($post['city'] ?? '')),
            'message'             => trim((string) ($post['message'] ?? $post['comments'] ?? '')),
            'packageName'         => $picked,
            'fallbackDestination' => $destination,
            'pageUrl'             => substr($landing, 0, 480),
            'source'              => 'LANDING_PAGE',
            'gclid'               => $api['gclid'],
            'utmSource'           => $api['utmSource'],
            'utmMedium'           => $api['utmMedium'],
            'utmCampaign'         => $api['utmCampaign'],
            // The full picture, kept alongside the lead for anyone who needs
            // to ask later how a particular one actually arrived.
            'extra'               => [
                'trafficChannel' => $attrib['channel'] ?? 'DIRECT',
                'fbclid'         => $attrib['fbclid'] ?? null,
                'referrer'       => $attrib['referrer'] ?? ($referer !== '' ? substr($referer, 0, 400) : null),
                'formGeneration' => isset($_POST['contact_submit']) ? 'gen1' : 'gen2',
            ],
            // Same visitor, same page, same minute is one submission — enough
            // to stop a double-click becoming two leads.
            'externalId'          => 'dycom-' . substr(sha1($phone . '|' . $landing . '|' . date('YmdHi')), 0, 24),
        ], 8);

        if (!$result['ok']) {
            error_log('[dy_capture] sync failed: ' . ($result['error'] ?? 'unknown'));
        }
    } catch (\Throwable $e) {
        error_log('[dy_capture] ' . $e->getMessage());
    }
});
