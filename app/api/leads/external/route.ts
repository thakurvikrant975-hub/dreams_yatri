import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createLead } from "@/app/actions/enquiry/intake.service";
import { externalLeadSchema, type ExternalLeadInput } from "./schema";

/**
 * Lead intake for sites we run that aren't this one — currently the PHP
 * landing pages on dreamsyatri.com, which post their form to their own PHP as
 * they always have and then forward it here server-to-server.
 *
 * Server-to-server on purpose: a browser-side call would put the shared secret
 * in front of anyone who opens devtools, and would need CORS besides. Nothing
 * about this route is meant to be reachable from a page.
 */

// Raw body is needed for the signature, so no static optimisation and no
// edge runtime (node:crypto).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far out of step a sender's clock may be. Anything older can't be
 * replayed against us; anything newer is a clock that needs fixing. */
const MAX_SKEW_MS = 5 * 60 * 1000;

type Verdict = { ok: true } | { ok: false; status: number; error: string };

/**
 * HMAC over `${timestamp}.${rawBody}`, the same shape the payment webhooks
 * verify. The timestamp is inside the signed string specifically so it can't
 * be edited to extend a captured request's life.
 */
function verifySignature(rawBody: string, headers: Headers): Verdict {
  const secret = process.env.EXTERNAL_LEADS_SECRET;
  if (!secret) {
    // Fail closed. An unset secret must never mean "let everyone in".
    console.error("[leads/external] EXTERNAL_LEADS_SECRET is not set — rejecting.");
    return { ok: false, status: 503, error: "Endpoint not configured" };
  }

  const signature = headers.get("x-dy-signature");
  const timestamp = headers.get("x-dy-timestamp");
  if (!signature || !timestamp) {
    return { ok: false, status: 401, error: "Missing signature" };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: "Stale or invalid timestamp" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  // Compare lengths first: timingSafeEqual throws on a mismatch rather than
  // returning false, and the length itself isn't a secret.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Bad signature" };
  }

  return { ok: true };
}

/**
 * Where the lead says it's going.
 *
 * What the visitor picked wins; the page's own subject is the fallback for the
 * many landing pages that never ask. Null is a real answer too — better an
 * honest "Not specified" on the report than a destination nobody chose.
 */
function resolveDestination(input: ExternalLeadInput): string | undefined {
  return input.destination ?? input.fallbackDestination ?? undefined;
}

/** The visitor's city has no column, so it rides along with whatever they
 * typed rather than being dropped on the floor. */
function composeMessage(input: ExternalLeadInput): string | undefined {
  const parts = [input.message, input.city ? `City: ${input.city}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

export async function POST(req: Request) {
  const rawBody = await req.text(); // MUST stay raw until the signature checks out

  const verdict = verifySignature(rawBody, req.headers);
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, error: verdict.error }, { status: verdict.status });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const parsed = externalLeadSchema.safeParse(payload);
  if (!parsed.success) {
    // 400, so a retry queue on the sender's side stops rather than replaying a
    // payload that can never succeed. The field list is what makes it fixable.
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed",
        fields: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const outcome = await createLead({
    name: input.name,
    phone: input.phone,
    countryCode: input.countryCode,
    email: input.email,
    packageName: input.packageName,
    destination: resolveDestination(input),
    packageUrl: input.packageUrl,
    pageUrl: input.pageUrl,
    travelDate: input.travelDate,
    travellers: input.persons,
    message: composeMessage(input),
    source: input.source ?? "LANDING_PAGE",
    gclid: input.gclid,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    externalId: input.externalId,
    extra: input.extra,
  });

  if (outcome.ok) {
    return NextResponse.json(
      { ok: true, id: outcome.id, created: !outcome.duplicate, duplicate: outcome.duplicate },
      { status: outcome.duplicate ? 200 : 201 },
    );
  }

  // Rate-limited and duplicate are decisions, not failures — the lead was
  // recognised and deliberately not written again. They come back 200 with
  // created:false so the sender marks the row done instead of retrying a
  // submission we will keep refusing.
  if (outcome.reason === "RATE_LIMITED" || outcome.reason === "DUPLICATE") {
    return NextResponse.json(
      { ok: true, created: false, reason: outcome.reason, message: outcome.message },
      { status: 200 },
    );
  }

  // Genuinely failed on our side — 503 so the sender's retry queue keeps it.
  return NextResponse.json({ ok: false, error: outcome.message }, { status: 503 });
}
