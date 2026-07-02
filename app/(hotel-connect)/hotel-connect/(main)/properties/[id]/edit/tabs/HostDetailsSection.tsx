"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { saveHostDetails, uploadOwnerLogo, type HostDetailsState } from "./host-details-actions";
import {
  sendMobileOtp, verifyMobileOtp,
} from "./verification-actions";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "../../../../components/ui/search-select";
import { MultiSearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { cn } from "@/app/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OwnerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phone_cc: string | null;
  whatsapp: string | null;
  whatsapp_cc: string | null;
  businessName: string | null;
  logo_url: string | null;
  gender: string | null;
  languages: string[];
  founded_year: number | null;
  property_count: number;
  business_description: string | null;
};

// ── Data ──────────────────────────────────────────────────────────────────────

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
  { value: "+86",  label: "China +86" },
  { value: "+45",  label: "Denmark +45" },
  { value: "+20",  label: "Egypt +20" },
  { value: "+33",  label: "France +33" },
  { value: "+49",  label: "Germany +49" },
  { value: "+30",  label: "Greece +30" },
  { value: "+852", label: "Hong Kong +852" },
  { value: "+62",  label: "Indonesia +62" },
  { value: "+98",  label: "Iran +98" },
  { value: "+353", label: "Ireland +353" },
  { value: "+972", label: "Israel +972" },
  { value: "+39",  label: "Italy +39" },
  { value: "+81",  label: "Japan +81" },
  { value: "+254", label: "Kenya +254" },
  { value: "+965", label: "Kuwait +965" },
  { value: "+60",  label: "Malaysia +60" },
  { value: "+960", label: "Maldives +960" },
  { value: "+52",  label: "Mexico +52" },
  { value: "+977", label: "Nepal +977" },
  { value: "+31",  label: "Netherlands +31" },
  { value: "+64",  label: "New Zealand +64" },
  { value: "+234", label: "Nigeria +234" },
  { value: "+47",  label: "Norway +47" },
  { value: "+92",  label: "Pakistan +92" },
  { value: "+63",  label: "Philippines +63" },
  { value: "+48",  label: "Poland +48" },
  { value: "+351", label: "Portugal +351" },
  { value: "+974", label: "Qatar +974" },
  { value: "+7",   label: "Russia +7" },
  { value: "+966", label: "Saudi Arabia +966" },
  { value: "+65",  label: "Singapore +65" },
  { value: "+27",  label: "South Africa +27" },
  { value: "+82",  label: "South Korea +82" },
  { value: "+34",  label: "Spain +34" },
  { value: "+94",  label: "Sri Lanka +94" },
  { value: "+46",  label: "Sweden +46" },
  { value: "+41",  label: "Switzerland +41" },
  { value: "+886", label: "Taiwan +886" },
  { value: "+66",  label: "Thailand +66" },
  { value: "+90",  label: "Turkey +90" },
  { value: "+971", label: "UAE +971" },
  { value: "+44",  label: "United Kingdom +44" },
  { value: "+1",   label: "USA / Canada +1" },
  { value: "+84",  label: "Vietnam +84" },
];

const LANGUAGES = [
  "English", "Hindi", "Bengali", "Marathi", "Telugu", "Tamil",
  "Gujarati", "Urdu", "Kannada", "Odia", "Malayalam", "Punjabi",
  "Assamese", "Maithili", "Sanskrit", "Kashmiri", "Nepali",
  "Konkani", "Dogri", "Manipuri", "Bodo", "Santhali", "Sindhi",
  "French", "German", "Spanish", "Japanese", "Chinese", "Arabic",
];

const CURRENT_YEAR = new Date().getFullYear();
function yearsDesc(from: number) {
  const out: string[] = [];
  for (let y = CURRENT_YEAR; y >= from; y--) out.push(String(y));
  return out;
}
const SINCE_YEARS = yearsDesc(1900);

// ── Verify step ───────────────────────────────────────────────────────────────

type VerifyStep = "idle" | "otp_sent" | "verified";

function isValidMobile(cc: string, v: string) {
  if (!v.trim()) return false;
  if (cc === "+91") return /^\d{10}$/.test(v.trim());
  return /^\d{5,15}$/.test(v.trim());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  error,
  action,
  children,
}: {
  label: string;
  hint?: string;
  error?: string[];
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {action}
      </div>
      {hint && <p className="text-xs text-neutral-500 -mt-0.5 leading-snug">{hint}</p>}
      {children}
      {error?.[0] && <p data-field-error className="text-xs text-red-500">{error[0]}</p>}
    </div>
  );
}

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
      <button type="button" onClick={onReset} className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
        Change
      </button>
    </span>
  );
}

function VerifyButton({ step, canSend, loading, onSend }: { step: VerifyStep; canSend: boolean; loading: boolean; onSend: () => void }) {
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

function OtpEntry({ otp, devOtp, loading, error, onChange, onConfirm }: {
  otp: string; devOtp: string; loading: boolean; error: string;
  onChange: (v: string) => void; onConfirm: () => void;
}) {
  return (
    <div className="mt-1 space-y-1.5">
      {devOtp && (
        <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Dev — OTP: <span className="font-mono">{devOtp}</span>
        </p>
      )}
      <div className="flex gap-2 items-center">
        <Input
          type="text" inputMode="numeric" maxLength={6} value={otp}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit OTP" className="max-w-37.5 font-mono tracking-widest"
        />
        <button
          type="button" disabled={otp.length !== 6 || loading} onClick={onConfirm}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Verifying…" : "Confirm"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Logo upload area ──────────────────────────────────────────────────────────

function LogoUpload({
  currentUrl,
  initials,
  onUploaded,
}: {
  currentUrl: string | null;
  initials: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG, or WebP allowed.");
      return;
    }
    if (file.size < 100 * 1024) { setError("File must be at least 100 KB."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("File must be under 15 MB."); return; }

    const fd = new FormData();
    fd.append("logo", file);
    setUploading(true);
    const res = await uploadOwnerLogo(fd);
    setUploading(false);
    if (res.error) { setError(res.error); return; }
    if (res.url) onUploaded(res.url);
  }

  return (
    <div className="flex gap-4 items-start">
      {/* Avatar / preview */}
      <div className="shrink-0 w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden border border-neutral-200">
        {currentUrl
          ? <img src={currentUrl} alt="Logo" className="w-full h-full object-cover" />
          : <span className="text-lg font-bold text-primary-600">{initials}</span>
        }
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
          dragging ? "border-primary-400 bg-primary-50" : "border-neutral-300 hover:border-primary-300",
          uploading && "opacity-60 pointer-events-none"
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {uploading ? (
          <p className="text-xs text-neutral-500">Uploading…</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-primary-600">
              Click to Upload <span className="font-normal text-neutral-500">or drag and drop</span>
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">JPG, JPEG or PNG (min. 100 KB & max. 15 MB)</p>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HostDetailsSection({ owner, locked = false, onSaved }: { owner: OwnerProfile; locked?: boolean; onSaved?: () => void }) {
  const [open, setOpen] = useState(!locked);
  const [state, formAction, isPending] = useActionState<HostDetailsState, FormData>(
    saveHostDetails, {}
  );

  useEffect(() => {
    if (state.ok) onSaved?.();
  }, [state.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Logo ───────────────────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState(owner.logo_url ?? "");

  // ── Dropdowns / selects ────────────────────────────────────────────────────
  const [phoneCC,    setPhoneCC]    = useState(owner.phone_cc    ?? "+91");
  const [whatsappCC, setWhatsappCC] = useState(owner.whatsapp_cc ?? "+91");
  const [gender,     setGender]     = useState(owner.gender ?? "");
  const [languages,  setLanguages]  = useState<string[]>(owner.languages ?? []);
  const [foundedYear, setFoundedYear] = useState(owner.founded_year?.toString() ?? "");
  const [propCount,  setPropCount]  = useState(owner.property_count ?? 1);

  // ── Phone verification ─────────────────────────────────────────────────────
  const [phoneInput,  setPhoneInput]  = useState(owner.phone ?? "");
  const [phoneStep,   setPhoneStep]   = useState<VerifyStep>(owner.phone ? "verified" : "idle");
  const [phoneOtp,    setPhoneOtp]    = useState("");
  const [phoneToken,  setPhoneToken]  = useState("");
  const [phoneDevOtp, setPhoneDevOtp] = useState("");
  const [phoneOtpErr, setPhoneOtpErr] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  function resetPhone() {
    setPhoneStep("idle"); setPhoneOtp(""); setPhoneToken(""); setPhoneDevOtp(""); setPhoneOtpErr("");
  }
  function onPhoneChange(v: string) {
    setPhoneInput(v);
    if (phoneStep !== "idle") resetPhone();
  }
  async function handleSendPhoneOtp() {
    setPhoneLoading(true); setPhoneOtpErr("");
    const res = await sendMobileOtp(phoneCC, phoneInput);
    setPhoneLoading(false);
    if (!res.ok) { setPhoneOtpErr(res.error ?? "Failed to send OTP"); return; }
    setPhoneToken(res.token!); setPhoneStep("otp_sent");
    if (res.devOtp) { setPhoneDevOtp(res.devOtp); setPhoneOtp(res.devOtp); }
  }
  async function handleVerifyPhoneOtp() {
    setPhoneLoading(true); setPhoneOtpErr("");
    const res = await verifyMobileOtp(phoneCC, phoneInput, phoneOtp, phoneToken);
    setPhoneLoading(false);
    if (!res.ok) { setPhoneOtpErr(res.error ?? "Verification failed"); return; }
    setPhoneStep("verified"); setPhoneDevOtp("");
  }

  const canVerifyPhone = isValidMobile(phoneCC, phoneInput) && phoneStep !== "verified";

  // ── Initials for avatar ────────────────────────────────────────────────────
  const initials = (owner.businessName || owner.name || "?")
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">

      {/* ── Accordion header ── */}
      <button
        type="button"
        onClick={() => { if (!locked) setOpen((v) => !v); }}
        className={cn(
          "w-full flex items-center justify-between px-6 py-4 transition-colors",
          locked ? "cursor-default opacity-60" : "hover:bg-neutral-50"
        )}
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-neutral-900">Host Details</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {locked ? "Complete property details above to unlock" : "Update your details here"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!locked && (
            <span className="text-xs text-primary-500 font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
              How guests will see your profile? Preview
            </span>
          )}
          {locked
            ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className="text-neutral-400 shrink-0"><path d="M208 96h-28V72a52 52 0 0 0-104 0v24H48a16 16 0 0 0-16 16v96a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V112a16 16 0 0 0-16-16ZM92 72a36 36 0 0 1 72 0v24H92Zm116 136H48V112h160v96Zm-84-24a8 8 0 0 1-8 8 8 8 0 0 1-8-8v-32a8 8 0 0 1 16 0Z"/></svg>
            : open
              ? <CaretUpIcon size={18} className="text-neutral-400 shrink-0" />
              : <CaretDownIcon size={18} className="text-neutral-400 shrink-0" />
          }
        </div>
      </button>

      {open && !locked && (
        <div className="border-t border-neutral-100">

          {/* Amber info banner */}
          <div className="mx-6 mt-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-500 font-bold text-sm leading-none mt-0.5">ℹ</span>
            <p className="text-xs text-amber-700 leading-snug">
              Since your host profile is already created with us, we&apos;ve pre-filled your details.
              You can edit these details anytime. Any updates made will reflect on all properties hosted by you.
            </p>
          </div>

          <form action={formAction} className="px-6 pb-6 space-y-7 mt-5">
            {/* Hidden fields */}
            <input type="hidden" name="logo_url"    value={logoUrl} />
            <input type="hidden" name="phone_cc"    value={phoneCC} />
            <input type="hidden" name="whatsapp_cc" value={whatsappCC} />
            <input type="hidden" name="gender"      value={gender} />
            <input type="hidden" name="languages"   value={languages.join(",")} />
            <input type="hidden" name="founded_year" value={foundedYear} />
            <input type="hidden" name="property_count" value={String(propCount)} />

            {state.error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
                {state.error}
              </div>
            )}

            {state.ok && (
              <div className="rounded-lg px-4 py-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200">
                Host details saved successfully.
              </div>
            )}

            {/* ── Business Details ── */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-4">Business Details</p>
              <div className="space-y-5">

                <FieldRow label="Upload your Business/Brand Logo" hint="Logo adds a professional touch to your listing">
                  <LogoUpload currentUrl={logoUrl || null} initials={initials} onUploaded={setLogoUrl} />
                </FieldRow>

                <FieldRow label="Display name for your business" hint="Your business name will be displayed as host for the guests">
                  <Input
                    name="businessName"
                    defaultValue={owner.businessName ?? ""}
                    placeholder="Eg: Ekta group"
                    disabled={isPending}
                  />
                </FieldRow>

                <FieldRow
                  label="Mobile number"
                  hint="This number is not shared with guests. It will only be used to send notifications regarding bookings, guest chat etc."
                  action={
                    phoneStep === "verified"
                      ? <VerifiedBadge onReset={() => { resetPhone(); setPhoneInput(""); }} />
                      : <VerifyButton step={phoneStep} canSend={canVerifyPhone} loading={phoneLoading} onSend={handleSendPhoneOtp} />
                  }
                >
                  <div className="flex gap-2">
                    <SearchSelect
                      options={COUNTRY_CODES} value={phoneCC} onChange={(v) => { setPhoneCC(v); if (phoneStep !== "idle") resetPhone(); }}
                      placeholder="+91" searchPlaceholder="Search country..." compact dropdownMinWidth={240}
                      disabled={isPending || phoneStep === "verified"} className="w-24 shrink-0"
                    />
                    <Input
                      name="phone" type="tel" maxLength={15}
                      value={phoneInput} onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter number" disabled={isPending || phoneStep === "verified"} className="flex-1"
                    />
                  </div>
                  {phoneStep === "otp_sent" && (
                    <OtpEntry
                      otp={phoneOtp} devOtp={phoneDevOtp} loading={phoneLoading} error={phoneOtpErr}
                      onChange={(v) => { setPhoneOtp(v); setPhoneOtpErr(""); }} onConfirm={handleVerifyPhoneOtp}
                    />
                  )}
                  {phoneStep !== "otp_sent" && phoneOtpErr && <p className="text-xs text-red-500">{phoneOtpErr}</p>}
                </FieldRow>

                <FieldRow
                  label="WhatsApp number"
                  hint="This number is not shared with guests. It will only be used to send notifications regarding bookings, guest chat etc."
                >
                  <div className="flex gap-2">
                    <SearchSelect
                      options={COUNTRY_CODES} value={whatsappCC} onChange={setWhatsappCC}
                      placeholder="+91" searchPlaceholder="Search country..." compact dropdownMinWidth={240}
                      disabled={isPending} className="w-24 shrink-0"
                    />
                    <Input
                      name="whatsapp" type="tel" maxLength={15}
                      defaultValue={owner.whatsapp ?? ""}
                      placeholder="Enter number" disabled={isPending} className="flex-1"
                    />
                  </div>
                </FieldRow>

                <FieldRow label="Gender">
                  <div className="flex items-center gap-6 h-10">
                    {(["male", "female"] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2.5 text-sm text-neutral-800 cursor-pointer select-none">
                        <input
                          type="radio" name="_gender_radio" value={g}
                          checked={gender === g} onChange={() => setGender(g)}
                          disabled={isPending} className="h-4 w-4 accent-primary-500 cursor-pointer"
                        />
                        {g === "male" ? "Male" : "Female"}
                      </label>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Email ID">
                  <div className="flex items-center gap-3">
                    <Input
                      value={owner.email} disabled readOnly
                      className="flex-1 bg-neutral-50 text-neutral-500 cursor-not-allowed"
                    />
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <circle cx="6" cy="6" r="6" fill="#10b981" />
                        <path d="M3.5 6l1.8 1.8L8.5 4.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Verified
                    </span>
                  </div>
                </FieldRow>

                <FieldRow
                  label="Languages your staff speaks"
                  hint="Lets guests know what languages they can use to communicate with your staff"
                >
                  <MultiSearchSelect
                    options={LANGUAGES}
                    value={languages}
                    onChange={setLanguages}
                    placeholder="Select language"
                    searchPlaceholder="Search languages..."
                  />
                </FieldRow>

              </div>
            </div>

            {/* ── Business Related ── */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-4">Business Related</p>
              <div className="space-y-5">

                <FieldRow label="Founded in / Serving Guests since (Year)">
                  <SearchSelect
                    options={SINCE_YEARS} value={foundedYear} onChange={setFoundedYear}
                    placeholder="Select a year" searchPlaceholder="Search year..." disabled={isPending}
                  />
                </FieldRow>

                <FieldRow label="Number of properties your business manages">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPropCount((v) => Math.max(1, v - 1))}
                      disabled={isPending || propCount <= 1}
                      className="w-9 h-9 rounded-lg border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-semibold text-neutral-800">{propCount}</span>
                    <button
                      type="button"
                      onClick={() => setPropCount((v) => Math.min(9999, v + 1))}
                      disabled={isPending}
                      className="w-9 h-9 rounded-lg border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                    >
                      +
                    </button>
                  </div>
                </FieldRow>

                <FieldRow label="Tell your guests more about your business">
                  <p className="text-xs text-neutral-500 -mt-0.5 leading-snug">
                    This will show in the &apos;Host Profile&apos; of all the properties where you are the host on DreamsYatri.
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                    <span className="text-amber-500 text-xs mt-0.5">⚠</span>
                    <p className="text-xs text-amber-700 leading-snug">
                      Do not share any sensitive information, contact details or any other inappropriate content
                    </p>
                  </div>
                  <textarea
                    name="business_description"
                    defaultValue={owner.business_description ?? ""}
                    rows={6}
                    disabled={isPending}
                    placeholder={`• Origin (Eg: Business was founded in 2016 by ABC Group to offer luxury stays in India)\n• Philosophy (Eg: Offering luxury stays with personalized experiences tailored to guests' preferences.)\n• Uniqueness (Eg: Offering unique stays like historic villas located in offbeat locations)`}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none disabled:opacity-60"
                  />
                </FieldRow>

              </div>
            </div>

            {/* ── Save button ── */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="h-10 px-6 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Saving…" : "Save Host Details"}
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
