<?php
/**
 * Forwards a lead from the PHP site (dreamsyatri.com, Hostinger) to the
 * Next.js dashboard's API on dreamsyatri.in, which writes it into Neon —
 * the database the sales dashboard and the lead report actually read.
 *
 * Drop-in: no Composer, no dependencies beyond curl + hash, both of which
 * Hostinger's PHP has by default.
 *
 * Design rules, because this runs while a visitor is waiting on a redirect:
 *   - It NEVER throws and never emits output. A lead that fails to sync is a
 *     row to retry later, not a broken thank-you page.
 *   - It has a short timeout. The visitor must not wait on our API.
 *   - It is called AFTER the local MySQL insert, so the local copy is the
 *     source of truth and this is a mirror.
 */

if (!function_exists('dy_lead_endpoint')) {

    /** Where the API lives. Override in dy_config.php if you ever stage it. */
    function dy_lead_endpoint(): string
    {
        return defined('DY_LEAD_ENDPOINT')
            ? DY_LEAD_ENDPOINT
            : 'https://dreamsyatri.in/api/leads/external';
    }

    /**
     * Signs and posts one lead.
     *
     * The signature covers "{timestamp}.{body}" using the exact byte string
     * that gets sent — json_encode is called once and that same string is
     * both signed and transmitted. Re-encoding for the send would risk a
     * different key order or escaping and every request would 401.
     *
     * @param  array $lead  Keys the API accepts; see README. Only name and
     *                      phone are required — omit anything the page
     *                      doesn't ask rather than sending a placeholder.
     * @return array{ok:bool,status:int,created:bool,id:?string,reason:?string,error:?string}
     */
    function dy_sync_lead(array $lead, int $timeout = 5): array
    {
        $out = ['ok' => false, 'status' => 0, 'created' => false, 'id' => null, 'reason' => null, 'error' => null];

        $secret = getenv('EXTERNAL_LEADS_SECRET');
        if (!$secret && defined('DY_LEAD_SECRET')) {
            $secret = DY_LEAD_SECRET;
        }
        if (!$secret) {
            $out['error'] = 'EXTERNAL_LEADS_SECRET not configured';
            error_log('[dy_lead_sync] secret not configured — lead not forwarded');
            return $out;
        }

        // Strip nulls and empty strings so the API sees "not asked" rather
        // than a blank answer. It tolerates both; this keeps the wire clean.
        $payload = [];
        foreach ($lead as $k => $v) {
            if ($v === null) continue;
            if (is_string($v) && trim($v) === '') continue;
            $payload[$k] = $v;
        }

        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($body === false) {
            $out['error'] = 'json_encode failed: ' . json_last_error_msg();
            error_log('[dy_lead_sync] ' . $out['error']);
            return $out;
        }

        // Milliseconds — the API compares against JavaScript's Date.now().
        $ts  = (string) round(microtime(true) * 1000);
        $sig = hash_hmac('sha256', $ts . '.' . $body, $secret);

        $ch = curl_init(dy_lead_endpoint());
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'X-DY-Timestamp: ' . $ts,
                'X-DY-Signature: ' . $sig,
                'Content-Length: ' . strlen($body),
            ],
        ]);

        $raw    = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err    = curl_error($ch);
        curl_close($ch);

        $out['status'] = $status;

        if ($raw === false) {
            $out['error'] = 'curl: ' . $err;
            error_log('[dy_lead_sync] ' . $out['error']);
            return $out;
        }

        $json = json_decode($raw, true);

        // 2xx means the API understood us. That includes the deliberate
        // refusals — a rate-limited or duplicate lead answers 200 with
        // created:false, and treating those as failures would make a retry
        // queue replay them forever.
        if ($status >= 200 && $status < 300 && is_array($json) && !empty($json['ok'])) {
            $out['ok']      = true;
            $out['created'] = !empty($json['created']);
            $out['id']      = $json['id'] ?? null;
            $out['reason']  = $json['reason'] ?? null;
            return $out;
        }

        // 400 is our own bad payload — it will never succeed, so callers
        // should stop rather than retry. Anything else is worth retrying.
        $out['error'] = 'HTTP ' . $status . ' ' . substr($raw, 0, 300);
        error_log('[dy_lead_sync] ' . $out['error']);
        return $out;
    }

    /** True when a failure is permanent and retrying is pointless. */
    function dy_sync_is_permanent_failure(array $result): bool
    {
        return $result['status'] === 400 || $result['status'] === 401;
    }
}
