// Pure, dependency-free readiness checks for a hotel's content — shared by the
// approvals list (readiness bar), the review page (per-section checklist) and
// the Hotels table. No server imports, so it is safe on both sides of the RSC
// boundary. Nothing here blocks anything: a manager can approve a hotel with
// open issues, these checks just tell them where to look first.

export const APPROVAL_SECTIONS = [
  { key: "basics", label: "Basics & description" },
  { key: "location", label: "Location" },
  { key: "contact", label: "Contact details" },
  { key: "rooms", label: "Rooms" },
  { key: "pricing", label: "Rates" },
  { key: "images", label: "Photos" },
  { key: "policies", label: "Policies" },
  { key: "commercials", label: "Margin & GST" },
  { key: "seo", label: "SEO" },
] as const;

export type ApprovalSectionKey = (typeof APPROVAL_SECTIONS)[number]["key"];

export const SECTION_LABELS: Record<ApprovalSectionKey, string> = Object.fromEntries(
  APPROVAL_SECTIONS.map((s) => [s.key, s.label]),
) as Record<ApprovalSectionKey, string>;

export type ChecklistItem = {
  section: ApprovalSectionKey;
  label: string;
  ok: boolean;
  /** Required items count towards readiness %; the rest are nice-to-haves. */
  required: boolean;
  /** Shown when the check fails — says what exactly is missing. */
  detail?: string;
};

export type ApprovalChecklistInput = {
  name: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  destination_id: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  business_phone: string | null;
  business_email: string | null;
  b2b_email: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  meta_title: string | null;
  meta_desc: string | null;
  margin_percentage: number;
  gst_percentage: number;
  imageCount: number;
  childPolicyCount: number;
  rooms: { name: string; pricingCount: number; imageCount: number }[];
};

export const MIN_HOTEL_PHOTOS = 5;
export const MIN_DESCRIPTION_CHARS = 120;

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
const list = (names: string[], max = 3) =>
  names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} +${names.length - max} more`;

export function buildChecklist(h: ApprovalChecklistInput): ChecklistItem[] {
  const roomsNoRates = h.rooms.filter((r) => r.pricingCount === 0).map((r) => r.name);
  const roomsNoPhotos = h.rooms.filter((r) => r.imageCount === 0).map((r) => r.name);

  return [
    // ── Basics ──
    { section: "basics", required: true, ok: filled(h.name), label: "Hotel name set" },
    {
      section: "basics", required: true,
      ok: (h.description ?? "").trim().length >= MIN_DESCRIPTION_CHARS,
      label: `Description of at least ${MIN_DESCRIPTION_CHARS} characters`,
      detail: filled(h.description)
        ? `Only ${(h.description ?? "").trim().length} characters — too thin for the website page`
        : "No description written yet",
    },
    { section: "basics", required: true, ok: filled(h.category), label: "Category set", detail: "No category picked" },
    { section: "basics", required: true, ok: filled(h.thumbnail), label: "Thumbnail image set", detail: "No thumbnail — listings will show a placeholder" },

    // ── Location ──
    { section: "location", required: true, ok: h.destination_id != null, label: "Linked to a destination", detail: "Not linked — the hotel won't appear under any destination" },
    { section: "location", required: true, ok: filled(h.address), label: "Street address filled", detail: "Address is empty" },
    {
      section: "location", required: true,
      ok: filled(h.city) && filled(h.state) && filled(h.country),
      label: "City, state and country filled",
      detail: `Missing: ${[!filled(h.city) && "city", !filled(h.state) && "state", !filled(h.country) && "country"].filter(Boolean).join(", ")}`,
    },
    { section: "location", required: false, ok: filled(h.pincode), label: "Pincode filled", detail: "Pincode is empty" },

    // ── Contact ──
    {
      section: "contact", required: true,
      ok: filled(h.business_phone) || filled(h.business_email),
      label: "A reachable business phone or email",
      detail: "Neither a business phone nor a business email is on file",
    },
    { section: "contact", required: false, ok: filled(h.b2b_email), label: "B2B email for rate requests", detail: "No B2B email — rate mails have nowhere to go" },

    // ── Rooms ──
    { section: "rooms", required: true, ok: h.rooms.length > 0, label: "At least one room added", detail: "No rooms added yet" },
    {
      section: "rooms", required: false,
      ok: roomsNoPhotos.length === 0,
      label: "Every room has at least one photo",
      detail: roomsNoPhotos.length > 0 ? `No photos on: ${list(roomsNoPhotos)}` : undefined,
    },

    // ── Rates ──
    {
      section: "pricing", required: true,
      ok: h.rooms.length > 0 && roomsNoRates.length === 0,
      label: "Every room has at least one rate plan",
      detail: h.rooms.length === 0 ? "No rooms, so nothing is priced" : `No rate plan on: ${list(roomsNoRates)}`,
    },

    // ── Photos ──
    {
      section: "images", required: true,
      ok: h.imageCount >= MIN_HOTEL_PHOTOS,
      label: `At least ${MIN_HOTEL_PHOTOS} property photos`,
      detail: `Only ${h.imageCount} photo${h.imageCount === 1 ? "" : "s"} uploaded`,
    },

    // ── Policies ──
    {
      section: "policies", required: true,
      ok: filled(h.check_in_time) && filled(h.check_out_time),
      label: "Check-in and check-out times set",
      detail: `Missing: ${[!filled(h.check_in_time) && "check-in", !filled(h.check_out_time) && "check-out"].filter(Boolean).join(" and ")} time`,
    },
    { section: "policies", required: false, ok: h.childPolicyCount > 0, label: "Child policy defined", detail: "No child policy rows — children are charged as adults by default" },

    // ── Commercials ──
    { section: "commercials", required: true, ok: h.margin_percentage > 0, label: "Margin percentage set", detail: "Margin is 0% — every booking sells at cost" },
    { section: "commercials", required: true, ok: h.gst_percentage > 0, label: "GST percentage set", detail: "GST is 0%" },

    // ── SEO ──
    { section: "seo", required: false, ok: filled(h.meta_title), label: "Meta title written", detail: "No meta title" },
    { section: "seo", required: false, ok: filled(h.meta_desc), label: "Meta description written", detail: "No meta description" },
  ];
}

export type ChecklistSummary = {
  items: ChecklistItem[];
  /** % of required checks that pass. */
  readinessPct: number;
  requiredFailed: number;
  optionalFailed: number;
  /** Sections with at least one failing required check. */
  weakSections: ApprovalSectionKey[];
};

export function summarizeChecklist(input: ApprovalChecklistInput): ChecklistSummary {
  const items = buildChecklist(input);
  const required = items.filter((i) => i.required);
  const requiredFailed = required.filter((i) => !i.ok).length;

  return {
    items,
    readinessPct: required.length === 0 ? 100 : Math.round(((required.length - requiredFailed) / required.length) * 100),
    requiredFailed,
    optionalFailed: items.filter((i) => !i.required && !i.ok).length,
    weakSections: [...new Set(items.filter((i) => i.required && !i.ok).map((i) => i.section))],
  };
}
