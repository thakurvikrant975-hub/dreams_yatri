# Building a new landing page on dreamsyatri.com

A new page needs to do two things: email the lead to the team, and get it into
the Neon database the dashboard reads.

**You only have to build the first one.** The database side is automatic — a
site-wide hook picks up every lead form on the site and forwards it. There is
nothing to install per page and no API key to paste anywhere. What matters is
that your form looks like the ones the hook already recognises, which is what
this document is about.

---

## The short version

1. Copy an existing page folder. `manali-tour-packages/` is the best template.
2. Rename the folder to something that names the destination (see §2).
3. Edit the copy's content, keeping the form's field names exactly as they are.
4. Submit a test lead and check it reaches both the inbox and the dashboard.

If you do only that, everything works. The rest of this file explains what
each part is doing, so you can tell what has gone wrong when something does.

---

## 1. Copy the template

    cd ~/public_html
    cp -r manali-tour-packages my-new-page

You get:

| file | what it is |
|---|---|
| `index.html`      | the page, including the lead form |
| `submit-form.php` | receives the form, validates, emails, writes a CSV backup |
| `thank-you.html`  | where the visitor lands after submitting |
| `assets/`         | css, js, images |
| `PHPMailer/`      | the mail library — must stay next to submit-form.php |
| `leads/`          | CSV backup of submissions, protected by its own .htaccess |

Delete any `*.bak-*` files that came along with the copy; they are old
revisions of that page and are not needed.

---

## 2. Name the folder carefully — it decides the destination

There is no destination field on most of these forms, so the folder name is
what tells the dashboard where the trip is. The lead report groups by
destination, so getting this wrong puts leads under the wrong heading or
under "Not specified".

The rules, applied in this order:

**Trip words are stripped from the end.** `-tour-packages`, `-packages`,
`-tours`, `-honeymoon`, `-family`, `-group`, `-couples`, `-trekking`, `-bike`,
`-safari`, `-scuba-diving`, `-ship`, `-mice`, and trailing numbers. Repeatedly,
so `gir-lion-safari-packages` reduces cleanly.

**Known destinations are collapsed.** Anything containing `goa` as a whole
word becomes **Goa** — so `goa-luxury-tour-packages` and `goa-mice-packages`
both report as Goa rather than inventing "Goa Luxury" and "Goa Mice" as
separate places. Same for Andaman, Kerala, Spiti, Sikkim, Meghalaya,
Rajasthan, Himachal, Uttarakhand, Kashmir, Ladakh, Lakshadweep, Karnataka,
Gujarat, Nepal, Thailand, Dubai, Pondicherry, Vizag.

**Towns map to their state.** `manali-*`, `shimla-*`, `kasol-*`, `jibhi-*`,
`kinnaur-*`, `dalhousie-*`, `kasauli-*`, `dharamshala-*` all report as
Himachal. `udaipur`, `jaipur`, `jaisalmer-*` report as Rajasthan. `amarnath`
is Kashmir, `chardham` is Uttarakhand, `orchha` is Madhya Pradesh.

**Anything else is title-cased as-is.** A new `bhutan-tour-packages/` folder
reports as **Bhutan** with no configuration needed. That is the intended way
to add a destination we have never sold before.

### Good and bad names

    kerala-monsoon-packages     -> Kerala       good
    manali-winter-tours         -> Himachal     good
    bhutan                      -> Bhutan       good, new destination
    lp-2026-v2                  -> Lp 2026 V2   BAD - meaningless in the report
    summer-special              -> Summer Special  BAD - not a place

If the page is a campaign variant of an existing destination, put the
destination first: `kerala-summer-special`, not `summer-special-kerala`.

---

## 3. Keep the form field names exactly as they are

The hook and the mail handler both read these names. Rename one and that value
silently stops being recorded.

| field | required | notes |
|---|---|---|
| `name`         | **yes** | no lead is forwarded without it |
| `phone`        | **yes** | no lead is forwarded without it |
| `email`        | no | |
| `package`      | no | the plan they picked, e.g. "Manali Honeymoon (4D/3N)" |
| `page_url`     | no | filled by the page's own JS |
| `utm_source` / `utm_medium` / `utm_campaign` | no | hidden, filled by the page's JS |
| `hp_field_x1`  | **keep it** | honeypot — see below |

### Do not remove the honeypot

`hp_field_x1` is a hidden field a human never fills. Bots fill everything, so
anything arriving with it filled is dropped — by the mail handler and by the
hook alike. Remove it and spam reaches both the team inbox and the sales
queue. It is deliberately not named "company" or "website", because Chrome's
address autofill ignores `autocomplete="off"` and will helpfully fill fields
with those names, which would silently discard real leads.

---

## 4. The form must submit one of two ways

The hook recognises a lead by exactly two signatures. A form that uses neither
will still email — and will silently never reach the dashboard.

**Preferred — what the template already does:**

    <form class="lead-form" id="leadForm" action="submit-form.php" method="POST">

Posting to a file named `submit-form.php` is the trigger. Keep that filename.

**Or, the older style:** include a submit button named `contact_submit`:

    <button type="submit" name="contact_submit">Plan My Trip</button>

Use the first for anything new. If you invent a third pattern — a new handler
filename with no `contact_submit` — tell whoever maintains the hook, or those
leads reach nobody's dashboard.

---

## 5. Email setup

`submit-form.php` carries its own SMTP settings near the top:

    $TO_EMAIL      = 'leads.dreamsyatri@gmail.com';
    $SMTP_HOST     = 'smtp.hostinger.com';
    $SMTP_PORT     = 465;
    $SMTP_USERNAME = 'no-reply@dreamsyatri.in';
    $SMTP_PASSWORD = '...';

Copying the template carries these over, so a new page mails correctly with no
edits. Change `$TO_EMAIL` only if this campaign should go somewhere else.

> **Note:** the SMTP password is currently written into every copy of
> `submit-form.php` — 44 files and counting. Rotating it means editing all of
> them. Worth moving to a single shared config; until then, be aware that a new
> page adds another copy.

---

## 6. Attribution works on its own

Do not add gclid or utm handling. The hook reads the arrival itself:

- `gclid` / `gbraid` / `wbraid` → Google Ads
- `msclkid` → Bing Ads
- `fbclid`, or a Facebook/Instagram referrer → Meta (paid only if the campaign
  is tagged `utm_medium=paid-social`; an `fbclid` alone rides on ordinary
  shared links too)
- a search-engine referrer with no click id → Organic
- nothing at all → Direct

First touch wins, remembered for 30 days, so the ad that earned the visit keeps
the credit even if the visitor browses before submitting.

The page's own JS fills the hidden `utm_*` fields from the query string. That
is fine to keep — where it finds something, it takes priority — but it will
usually be empty, because Google Ads sends `gclid`, not utm parameters. That is
expected and not a bug.

---

## 7. Test before pointing ad spend at it

    https://dreamsyatri.com/my-new-page/?gclid=TEST123

Submit the form, then check all three:

1. **Thank-you page** loads.
2. **Email** arrives at `leads.dreamsyatri@gmail.com`.
3. **Dashboard** — the lead appears in the Lead Manager queue with the right
   destination, and its source shows Google rather than untagged.

Use a phone number you can recognise. Note there is a **15-minute rate limit
per phone number**: submitting twice from the same number inside 15 minutes is
deliberately treated as one lead, so use a different number for a second test.

If the email arrives but the dashboard does not show it, the form is not
matching §4 — that is the first thing to check.

---

## 8. Things that will break every page at once

**Do not remove this block from `~/public_html/.htaccess`:**

    # Lead capture bridge (dreamsyatri.in). Remove this block to disable.
    php_value auto_prepend_file "/home/u329953352/dy_lead_bridge/dy_capture.php"

That single line is what forwards every lead on the site. Without it, all
pages keep emailing and none reach the database.

`.user.ini` does **not** work on this server — LiteSpeed has `user_ini.filename`
disabled — so the directive has to live in `.htaccess`. Do not "tidy" it into a
`.user.ini`; it will look installed and do nothing.

**Do not move or rename** `~/dy_lead_bridge/`. Its three files are referenced by
absolute path.

---

## 9. When something is wrong

    # is the hook still wired in?
    grep auto_prepend_file ~/public_html/.htaccess

    # what has it complained about lately?
    grep dy_capture ~/error_log | tail -20

A successful forward logs nothing. `[dy_capture] sync failed: …` means the lead
emailed but did not reach the database — the message says why.

### Rolling back

    cp ~/public_html/.htaccess.bak-20260901-093920 ~/public_html/.htaccess

Restores the site to before the bridge existed. Takes effect immediately.
Full-site backups and per-file restore instructions are in `~/backups/RESTORE.md`.
