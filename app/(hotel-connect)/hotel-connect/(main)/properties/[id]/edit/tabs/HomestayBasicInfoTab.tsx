"use client";

import { useActionState, useState } from "react";
import { saveHomestayBasicInfo } from "./homestay-basic-info-actions";
import {
  sendEmailOtp, verifyEmailOtp,
  sendMobileOtp, verifyMobileOtp,
} from "./verification-actions";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "../../../../components/ui/search-select";
import type { HomestayBasicInfoState, HomestayBasicInfoValues } from "./homestay-basic-info-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HomestayBasicInfo = {
  id: number;
  name: string;
  year_built: number | null;
  booking_since_year: number | null;
  hosted_as: string | null;
  host_lives_at_property: boolean | null;
  contact_email: string | null;
  contact_mobile_cc: string | null;
  contact_mobile: string | null;
  whatsapp_same_as_mobile: boolean;
  contact_whatsapp: string | null;
  contact_landline: string | null;
};

// ── Verification step ─────────────────────────────────────────────────────────

type VerifyStep = "idle" | "otp_sent" | "verified";

// ── Country dial codes ────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { value: "+91",  label: "India +91" },
  { value: "+93",  label: "Afghanistan +93" },
  { value: "+355", label: "Albania +355" },
  { value: "+213", label: "Algeria +213" },
  { value: "+244", label: "Angola +244" },
  { value: "+54",  label: "Argentina +54" },
  { value: "+61",  label: "Australia +61" },
  { value: "+43",  label: "Austria +43" },
  { value: "+880", label: "Bangladesh +880" },
  { value: "+32",  label: "Belgium +32" },
  { value: "+55",  label: "Brazil +55" },
  { value: "+359", label: "Bulgaria +359" },
  { value: "+855", label: "Cambodia +855" },
  { value: "+1",   label: "Canada / USA +1" },
  { value: "+56",  label: "Chile +56" },
  { value: "+86",  label: "China +86" },
  { value: "+57",  label: "Colombia +57" },
  { value: "+385", label: "Croatia +385" },
  { value: "+357", label: "Cyprus +357" },
  { value: "+420", label: "Czech Republic +420" },
  { value: "+45",  label: "Denmark +45" },
  { value: "+20",  label: "Egypt +20" },
  { value: "+372", label: "Estonia +372" },
  { value: "+251", label: "Ethiopia +251" },
  { value: "+358", label: "Finland +358" },
  { value: "+33",  label: "France +33" },
  { value: "+49",  label: "Germany +49" },
  { value: "+233", label: "Ghana +233" },
  { value: "+30",  label: "Greece +30" },
  { value: "+852", label: "Hong Kong +852" },
  { value: "+36",  label: "Hungary +36" },
  { value: "+62",  label: "Indonesia +62" },
  { value: "+98",  label: "Iran +98" },
  { value: "+964", label: "Iraq +964" },
  { value: "+353", label: "Ireland +353" },
  { value: "+972", label: "Israel +972" },
  { value: "+39",  label: "Italy +39" },
  { value: "+225", label: "Ivory Coast +225" },
  { value: "+81",  label: "Japan +81" },
  { value: "+962", label: "Jordan +962" },
  { value: "+254", label: "Kenya +254" },
  { value: "+965", label: "Kuwait +965" },
  { value: "+856", label: "Laos +856" },
  { value: "+371", label: "Latvia +371" },
  { value: "+961", label: "Lebanon +961" },
  { value: "+231", label: "Liberia +231" },
  { value: "+370", label: "Lithuania +370" },
  { value: "+352", label: "Luxembourg +352" },
  { value: "+60",  label: "Malaysia +60" },
  { value: "+960", label: "Maldives +960" },
  { value: "+223", label: "Mali +223" },
  { value: "+356", label: "Malta +356" },
  { value: "+52",  label: "Mexico +52" },
  { value: "+373", label: "Moldova +373" },
  { value: "+976", label: "Mongolia +976" },
  { value: "+212", label: "Morocco +212" },
  { value: "+258", label: "Mozambique +258" },
  { value: "+95",  label: "Myanmar +95" },
  { value: "+264", label: "Namibia +264" },
  { value: "+977", label: "Nepal +977" },
  { value: "+31",  label: "Netherlands +31" },
  { value: "+64",  label: "New Zealand +64" },
  { value: "+234", label: "Nigeria +234" },
  { value: "+47",  label: "Norway +47" },
  { value: "+968", label: "Oman +968" },
  { value: "+92",  label: "Pakistan +92" },
  { value: "+970", label: "Palestine +970" },
  { value: "+507", label: "Panama +507" },
  { value: "+63",  label: "Philippines +63" },
  { value: "+48",  label: "Poland +48" },
  { value: "+351", label: "Portugal +351" },
  { value: "+974", label: "Qatar +974" },
  { value: "+40",  label: "Romania +40" },
  { value: "+7",   label: "Russia +7" },
  { value: "+966", label: "Saudi Arabia +966" },
  { value: "+221", label: "Senegal +221" },
  { value: "+381", label: "Serbia +381" },
  { value: "+65",  label: "Singapore +65" },
  { value: "+421", label: "Slovakia +421" },
  { value: "+386", label: "Slovenia +386" },
  { value: "+252", label: "Somalia +252" },
  { value: "+27",  label: "South Africa +27" },
  { value: "+82",  label: "South Korea +82" },
  { value: "+34",  label: "Spain +34" },
  { value: "+94",  label: "Sri Lanka +94" },
  { value: "+249", label: "Sudan +249" },
  { value: "+46",  label: "Sweden +46" },
  { value: "+41",  label: "Switzerland +41" },
  { value: "+963", label: "Syria +963" },
  { value: "+886", label: "Taiwan +886" },
  { value: "+255", label: "Tanzania +255" },
  { value: "+66",  label: "Thailand +66" },
  { value: "+216", label: "Tunisia +216" },
  { value: "+90",  label: "Turkey +90" },
  { value: "+256", label: "Uganda +256" },
  { value: "+380", label: "Ukraine +380" },
  { value: "+971", label: "UAE +971" },
  { value: "+44",  label: "United Kingdom +44" },
  { value: "+598", label: "Uruguay +598" },
  { value: "+998", label: "Uzbekistan +998" },
  { value: "+58",  label: "Venezuela +58" },
  { value: "+84",  label: "Vietnam +84" },
  { value: "+967", label: "Yemen +967" },
  { value: "+260", label: "Zambia +260" },
  { value: "+263", label: "Zimbabwe +263" },
];

// ── Year helpers ──────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();

function yearsDesc(from: number): string[] {
  const out: string[] = [];
  for (let y = CURRENT_YEAR; y >= from; y--) out.push(String(y));
  return out;
}

const BUILT_YEARS = yearsDesc(1800);
const SINCE_YEARS = yearsDesc(1990);

// ── Small helpers ─────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidMobile(cc: string, v: string) {
  if (!v.trim()) return false;
  if (cc === "+91") return /^\d{10}$/.test(v.trim());
  return /^\d{5,15}$/.test(v.trim());
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p data-field-error className="text-xs text-red-500">{errors[0]}</p>;
}

function FieldRow({
  label,
  error,
  required,
  hint,
  action,
  children,
}: {
  label: string;
  error?: string[];
  required?: boolean;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        {action}
      </div>
      {hint && <p className="text-xs text-neutral-500 -mt-0.5">{hint}</p>}
      {children}
      <FieldError errors={error} />
    </div>
  );
}

// ── Verify badge / button ─────────────────────────────────────────────────────

function VerifiedBadge({ onReset }: { onReset: () => void }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="6" fill="#10b981" />
          <path d="M3.5 6l1.8 1.8L8.5 4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
      <button
        type="button"
        className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
        onClick={onReset}
      >
        Change
      </button>
    </span>
  );
}

function VerifyButton({
  step,
  canSend,
  loading,
  onSend,
}: {
  step: VerifyStep;
  canSend: boolean;
  loading: boolean;
  onSend: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canSend || loading}
      onClick={onSend}
      className="text-xs font-semibold text-primary-500 hover:text-primary-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? "Sending…" : step === "otp_sent" ? "Resend" : "Verify"}
    </button>
  );
}

// ── OTP inline entry ──────────────────────────────────────────────────────────

function OtpEntry({
  otp,
  devOtp,
  loading,
  error,
  onChange,
  onConfirm,
}: {
  otp: string;
  devOtp: string;
  loading: boolean;
  error: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-1 space-y-1.5">
      {devOtp && (
        <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Dev mode — OTP auto-filled: <span className="font-mono">{devOtp}</span>
        </p>
      )}
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit OTP"
          className="max-w-37.5 font-mono tracking-widest"
        />
        <button
          type="button"
          disabled={otp.length !== 6 || loading}
          onClick={onConfirm}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying…" : "Confirm"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomestayBasicInfoTab({ hotel }: { hotel: HomestayBasicInfo }) {
  const boundAction = saveHomestayBasicInfo.bind(null, hotel.id);
  const [state, formAction, isPending] = useActionState<HomestayBasicInfoState, FormData>(
    boundAction,
    {}
  );

  // ── Dropdown state ─────────────────────────────────────────────────────────
  const [mobileCC,      setMobileCC]      = useState(hotel.contact_mobile_cc ?? "+91");
  const [whatsappCC,    setWhatsappCC]    = useState(hotel.contact_mobile_cc ?? "+91");
  const [yearBuilt,     setYearBuilt]     = useState(hotel.year_built?.toString() ?? "");
  const [bookingSince,  setBookingSince]  = useState(hotel.booking_since_year?.toString() ?? "");
  const [whatsappSame,  setWhatsappSame]  = useState(hotel.whatsapp_same_as_mobile);

  // ── Hosting type state ─────────────────────────────────────────────────────
  const [hostedAs, setHostedAs] = useState<string>(hotel.hosted_as ?? "");
  const [hostLives, setHostLives] = useState<string>(
    hotel.host_lives_at_property === true ? "yes" : hotel.host_lives_at_property === false ? "no" : ""
  );

  // ── Controlled contact inputs ──────────────────────────────────────────────
  const [emailInput,  setEmailInput]  = useState(hotel.contact_email  ?? "");
  const [mobileInput, setMobileInput] = useState(hotel.contact_mobile ?? "");

  // ── Email verification state ───────────────────────────────────────────────
  const [emailStep,    setEmailStep]    = useState<VerifyStep>(hotel.contact_email ? "verified" : "idle");
  const [emailOtp,     setEmailOtp]     = useState("");
  const [emailToken,   setEmailToken]   = useState("");
  const [emailDevOtp,  setEmailDevOtp]  = useState("");
  const [emailOtpErr,  setEmailOtpErr]  = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // ── Mobile verification state ──────────────────────────────────────────────
  const [mobileStep,    setMobileStep]    = useState<VerifyStep>(hotel.contact_mobile ? "verified" : "idle");
  const [mobileOtp,     setMobileOtp]     = useState("");
  const [mobileToken,   setMobileToken]   = useState("");
  const [mobileDevOtp,  setMobileDevOtp]  = useState("");
  const [mobileOtpErr,  setMobileOtpErr]  = useState("");
  const [mobileLoading, setMobileLoading] = useState(false);

  // ── Field errors ───────────────────────────────────────────────────────────
  const [clientErrors, setClientErrors] = useState<NonNullable<HomestayBasicInfoState["fieldErrors"]>>({});

  const initialName = hotel.name === "My Property" ? "" : hotel.name;
  const fe = { ...(state.fieldErrors ?? {}), ...clientErrors };

  function clearError(field: keyof HomestayBasicInfoValues) {
    if (!clientErrors[field]) return;
    setClientErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  // ── Email helpers ──────────────────────────────────────────────────────────

  function resetEmail() {
    setEmailStep("idle");
    setEmailOtp("");
    setEmailToken("");
    setEmailDevOtp("");
    setEmailOtpErr("");
  }

  function onEmailChange(v: string) {
    setEmailInput(v);
    if (emailStep !== "idle") resetEmail();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) clearError("contact_email");
  }

  async function handleSendEmailOtp() {
    setEmailLoading(true);
    setEmailOtpErr("");
    const res = await sendEmailOtp(emailInput);
    setEmailLoading(false);
    if (!res.ok) { setEmailOtpErr(res.error ?? "Failed to send OTP"); return; }
    setEmailToken(res.token!);
    setEmailStep("otp_sent");
    if (res.devOtp) { setEmailDevOtp(res.devOtp); setEmailOtp(res.devOtp); }
  }

  async function handleVerifyEmailOtp() {
    setEmailLoading(true);
    setEmailOtpErr("");
    const res = await verifyEmailOtp(emailInput, emailOtp, emailToken);
    setEmailLoading(false);
    if (!res.ok) { setEmailOtpErr(res.error ?? "Verification failed"); return; }
    setEmailStep("verified");
    setEmailDevOtp("");
    clearError("contact_email");
  }

  // ── Mobile helpers ─────────────────────────────────────────────────────────

  function resetMobile() {
    setMobileStep("idle");
    setMobileOtp("");
    setMobileToken("");
    setMobileDevOtp("");
    setMobileOtpErr("");
  }

  function onMobileChange(v: string) {
    setMobileInput(v);
    if (mobileStep !== "idle") resetMobile();
    if (/^\d{10}$/.test(v) && mobileCC === "+91") clearError("contact_mobile");
  }

  function onMobileCCChange(v: string) {
    setMobileCC(v);
    if (mobileStep !== "idle") resetMobile();
  }

  async function handleSendMobileOtp() {
    setMobileLoading(true);
    setMobileOtpErr("");
    const res = await sendMobileOtp(mobileCC, mobileInput);
    setMobileLoading(false);
    if (!res.ok) { setMobileOtpErr(res.error ?? "Failed to send OTP"); return; }
    setMobileToken(res.token!);
    setMobileStep("otp_sent");
    if (res.devOtp) { setMobileDevOtp(res.devOtp); setMobileOtp(res.devOtp); }
  }

  async function handleVerifyMobileOtp() {
    setMobileLoading(true);
    setMobileOtpErr("");
    const res = await verifyMobileOtp(mobileCC, mobileInput, mobileOtp, mobileToken);
    setMobileLoading(false);
    if (!res.ok) { setMobileOtpErr(res.error ?? "Verification failed"); return; }
    setMobileStep("verified");
    setMobileDevOtp("");
    clearError("contact_mobile");
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(data: FormData): NonNullable<HomestayBasicInfoState["fieldErrors"]> {
    const errs: NonNullable<HomestayBasicInfoState["fieldErrors"]> = {};

    const name = (data.get("name") as string ?? "").trim();
    if (name.length < 2) errs.name = ["Property name must be at least 2 characters"];

    if (!yearBuilt)    errs.year_built         = ["Please select the year of construction"];
    if (!bookingSince) errs.booking_since_year = ["Please select the year bookings started"];

    if (yearBuilt && bookingSince && Number(yearBuilt) > Number(bookingSince))
      errs.year_built = ["Year of construction cannot be later than when bookings started"];

    if (emailInput) {
      if (!isValidEmail(emailInput))
        errs.contact_email = ["Enter a valid email address"];
      else if (emailStep !== "verified")
        errs.contact_email = ["Please verify your email address"];
    }

    if (mobileInput) {
      if (!isValidMobile(mobileCC, mobileInput))
        errs.contact_mobile = [
          mobileCC === "+91"
            ? "Enter a valid 10-digit number for India (+91)"
            : "Enter a valid mobile number",
        ];
      else if (mobileStep !== "verified")
        errs.contact_mobile = ["Please verify your mobile number"];
    }

    return errs;
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    const errs = validate(new FormData(e.currentTarget));
    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setClientErrors(errs);
      requestAnimationFrame(() => {
        document.querySelector("[data-field-error]")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    } else {
      setClientErrors({});
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const canVerifyEmail  = isValidEmail(emailInput)  && emailStep !== "verified";
  const canVerifyMobile = isValidMobile(mobileCC, mobileInput) && mobileStep !== "verified";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form id="wizard-form" action={formAction} onSubmit={handleSubmit} className="space-y-5">

      {state.error && (
        <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          {state.error}
        </div>
      )}

      {/* ── Section 1: Property Details ───────────────────────────────── */}
      <SectionCard title="Property Details">

        <FieldRow
          label="Property Name"
          required
          hint="Use the official name as it appears on your registration certificate"
          error={fe.name}
        >
          <Input
            name="name"
            defaultValue={initialName}
            placeholder="e.g. The Green Valley Homestay"
            disabled={isPending}
            aria-invalid={!!fe.name}
            onChange={(e) => { if (e.target.value.trim().length >= 2) clearError("name"); }}
          />
        </FieldRow>

        <FieldRow label="Year of Construction" error={fe.year_built}>
          <SearchSelect
            name="year_built"
            options={BUILT_YEARS}
            value={yearBuilt}
            onChange={(v) => { setYearBuilt(v); clearError("year_built"); }}
            placeholder="Select a year"
            searchPlaceholder="Search year..."
            disabled={isPending}
            error={!!fe.year_built}
          />
        </FieldRow>

        <FieldRow
          label="Accepting Bookings Since"
          hint="The year you first started accepting guest reservations"
          error={fe.booking_since_year}
        >
          <SearchSelect
            name="booking_since_year"
            options={SINCE_YEARS}
            value={bookingSince}
            onChange={(v) => {
              setBookingSince(v);
              clearError("booking_since_year");
              if (yearBuilt && Number(yearBuilt) <= Number(v)) clearError("year_built");
            }}
            placeholder="Select a year"
            searchPlaceholder="Search year..."
            disabled={isPending}
            error={!!fe.booking_since_year}
          />
        </FieldRow>

        {/* Hidden field so form always submits host_lives_at_property */}
        <input type="hidden" name="host_lives_at_property" value={hostLives} />

        <FieldRow label="How will this property be hosted?">
          <div className="space-y-3 pt-0.5">
            <label className={`flex gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${hostedAs === "individually" ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 hover:border-neutral-300"}`}>
              <input
                type="radio"
                name="hosted_as"
                value="individually"
                checked={hostedAs === "individually"}
                onChange={() => setHostedAs("individually")}
                disabled={isPending}
                className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-800">Individually</span>
                <span className="block text-xs text-neutral-500 mt-0.5 leading-snug">
                  You own and personally manage this property. Guests deal directly with you.
                </span>
              </span>
            </label>

            <label className={`flex gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${hostedAs === "as_part_of_business" ? "border-primary-500 bg-primary-50/60" : "border-neutral-200 hover:border-neutral-300"}`}>
              <input
                type="radio"
                name="hosted_as"
                value="as_part_of_business"
                checked={hostedAs === "as_part_of_business"}
                onChange={() => setHostedAs("as_part_of_business")}
                disabled={isPending}
                className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
              />
              <span>
                <span className="block text-sm font-semibold text-neutral-800">As part of a business</span>
                <span className="block text-xs text-neutral-500 mt-0.5 leading-snug">
                  This property is managed under a registered business or company.
                </span>
              </span>
            </label>
          </div>
        </FieldRow>

        <FieldRow label="Do you (host) live at this property?">
          <div className="flex items-center gap-6 h-10">
            <label className="flex items-center gap-2.5 text-sm text-neutral-800 cursor-pointer select-none">
              <input
                type="radio"
                name="_host_lives_radio"
                value="no"
                checked={hostLives === "no"}
                onChange={() => setHostLives("no")}
                disabled={isPending}
                className="h-4 w-4 accent-primary-500 cursor-pointer"
              />
              No
            </label>
            <label className="flex items-center gap-2.5 text-sm text-neutral-800 cursor-pointer select-none">
              <input
                type="radio"
                name="_host_lives_radio"
                value="yes"
                checked={hostLives === "yes"}
                onChange={() => setHostLives("yes")}
                disabled={isPending}
                className="h-4 w-4 accent-primary-500 cursor-pointer"
              />
              Yes
            </label>
          </div>
        </FieldRow>

      </SectionCard>

      {/* ── Section 2: Contact Information ────────────────────────────── */}
      <SectionCard
        title="Contact Information"
        desc="Visible to DreamsYatri team only — not shown on public listing."
      >

        {/* ── Email ── */}
        <FieldRow
          label="Email ID"
          error={fe.contact_email}
          action={
            emailStep === "verified"
              ? <VerifiedBadge onReset={() => { resetEmail(); setEmailInput(""); }} />
              : <VerifyButton
                  step={emailStep}
                  canSend={canVerifyEmail}
                  loading={emailLoading}
                  onSend={handleSendEmailOtp}
                />
          }
        >
          <Input
            name="contact_email"
            type="email"
            value={emailInput}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter email ID"
            disabled={isPending || emailStep === "verified"}
            aria-invalid={!!fe.contact_email}
          />
          {emailStep === "otp_sent" && (
            <OtpEntry
              otp={emailOtp}
              devOtp={emailDevOtp}
              loading={emailLoading}
              error={emailOtpErr}
              onChange={(v) => { setEmailOtp(v); setEmailOtpErr(""); }}
              onConfirm={handleVerifyEmailOtp}
            />
          )}
          {emailStep !== "otp_sent" && emailOtpErr && (
            <p className="text-xs text-red-500">{emailOtpErr}</p>
          )}
        </FieldRow>

        {/* ── Mobile ── */}
        <FieldRow
          label="Mobile Number"
          error={fe.contact_mobile}
          action={
            mobileStep === "verified"
              ? <VerifiedBadge onReset={() => { resetMobile(); setMobileInput(""); }} />
              : <VerifyButton
                  step={mobileStep}
                  canSend={canVerifyMobile}
                  loading={mobileLoading}
                  onSend={handleSendMobileOtp}
                />
          }
        >
          <div className="flex gap-2">
            <SearchSelect
              name="contact_mobile_cc"
              options={COUNTRY_CODES}
              value={mobileCC}
              onChange={onMobileCCChange}
              placeholder="+91"
              searchPlaceholder="Search country..."
              compact
              dropdownMinWidth={240}
              disabled={isPending || mobileStep === "verified"}
              className="w-24 shrink-0"
            />
            <Input
              name="contact_mobile"
              type="tel"
              maxLength={15}
              value={mobileInput}
              onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter number"
              disabled={isPending || mobileStep === "verified"}
              className="flex-1"
              aria-invalid={!!fe.contact_mobile}
            />
          </div>
          {mobileStep === "otp_sent" && (
            <OtpEntry
              otp={mobileOtp}
              devOtp={mobileDevOtp}
              loading={mobileLoading}
              error={mobileOtpErr}
              onChange={(v) => { setMobileOtp(v); setMobileOtpErr(""); }}
              onConfirm={handleVerifyMobileOtp}
            />
          )}
          {mobileStep !== "otp_sent" && mobileOtpErr && (
            <p className="text-xs text-red-500">{mobileOtpErr}</p>
          )}
          <label className="flex items-center gap-2.5 text-sm text-neutral-700 cursor-pointer select-none mt-0.5">
            <input
              type="checkbox"
              name="whatsapp_same_as_mobile"
              checked={whatsappSame}
              onChange={(e) => setWhatsappSame(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-neutral-300 accent-primary-500 cursor-pointer"
            />
            Use the same mobile number for WhatsApp
          </label>
        </FieldRow>

        {/* ── WhatsApp ── */}
        {!whatsappSame && (
          <FieldRow label="WhatsApp Number" error={fe.contact_whatsapp}>
            <div className="flex gap-2">
              <SearchSelect
                options={COUNTRY_CODES}
                value={whatsappCC}
                onChange={setWhatsappCC}
                placeholder="+91"
                searchPlaceholder="Search country..."
                compact
                dropdownMinWidth={240}
                disabled={isPending}
                className="w-24 shrink-0"
              />
              <Input
                name="contact_whatsapp"
                type="tel"
                maxLength={15}
                defaultValue={hotel.contact_whatsapp ?? ""}
                placeholder="Enter number"
                disabled={isPending}
                className="flex-1"
              />
            </div>
          </FieldRow>
        )}

        {/* ── Landline ── */}
        <FieldRow label="Landline Number (Optional)" error={fe.contact_landline}>
          <Input
            name="contact_landline"
            type="tel"
            defaultValue={hotel.contact_landline ?? ""}
            placeholder="Eg: 0124 46373533"
            disabled={isPending}
          />
        </FieldRow>

      </SectionCard>

    </form>
  );
}
