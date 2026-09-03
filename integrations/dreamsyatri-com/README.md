# dreamsyatri.com → dreamsyatri.in lead bridge

Forwards every lead submitted on the PHP site into the Neon database the
dashboard reads, so they appear in the sales queue and the lead report.

## Why it is a global hook and not 92 edits

The .com site has ~92 form handlers that have drifted apart over the years.
**Only three of them write to MySQL** — the rest email the lead and keep no
record at all. Editing all 92 would mean 92 chances to break a live landing
page, so instead one script runs before every request, ignores everything that
is not a lead POST, and forwards the ones that are.

## Layout on the server

    /home/u329953352/dy_lead_bridge/     ← outside public_html, not servable
        dy_config.php                    ← the shared secret
        dy_lead_sync.php                 ← signs and POSTs
        dy_capture.php                   ← the hook

    /home/u329953352/public_html/.user.ini
        auto_prepend_file = /home/u329953352/dy_lead_bridge/dy_capture.php

## Install

1. `mkdir ~/dy_lead_bridge` and upload the three PHP files.
2. Copy `dy_config.php.example` to `dy_config.php`, set `DY_LEAD_SECRET`.
3. Set the same value as `EXTERNAL_LEADS_SECRET` in the Next.js app's env.
4. Add the `.user.ini` line above. Changes take up to 5 minutes
   (`user_ini.cache_ttl` is 300).

## Removing it

Delete the `auto_prepend_file` line from `.user.ini`. Nothing else on the site
references these files, so that alone fully disables it.

## Behaviour

- Runs on every request but returns immediately unless the request is a POST
  carrying `contact_submit`.
- Forwards in a shutdown handler, after the response and the handler's own
  redirect have already gone out, so no visitor waits on it.
- Never prints and never throws. A forwarding failure is logged to
  `error_log` and nothing else changes: the visitor still gets the thank-you
  page and the team still gets the email.
- Destination comes from the landing page's own directory name, since most
  forms never ask. The form's own `destination` select holds a *package*
  label, so it is sent as `packageName`.
- `gclid` / `utm_*` come from the query string, then a cookie, so a visitor
  who browses before submitting is still attributed.

## Verifying

    tail -f ~/error_log | grep dy_capture

A successful lead logs nothing. Failures log `[dy_capture] sync failed: …`.
