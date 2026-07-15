"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  saveFinance,
  uploadFinanceDocument,
  removeFinanceDocument,
  type FinanceState,
} from "./finance-actions";
import { HotelBusinessType } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import {
  CheckIcon,
  CaretDownIcon,
  CaretUpIcon,
  UploadSimpleIcon,
  TrashIcon,
  FileIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

// ── Constants ─────────────────────────────────────────────────────────────────

const IFSC_BANK_MAP: Record<string, string> = {
  SBIN: "State Bank of India",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  BKID: "Bank of India",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
  RATN: "RBL Bank",
  IDFB: "IDFC First Bank",
  BDBL: "Bandhan Bank",
  IBKL: "IDBI Bank",
  JAKA: "Jammu & Kashmir Bank",
  KARB: "Karnataka Bank",
  KVBL: "Karur Vysya Bank",
  SIBL: "South Indian Bank",
  DCBL: "DCB Bank",
  TMBL: "Tamilnad Mercantile Bank",
  UCBA: "UCO Bank",
  MAHB: "Bank of Maharashtra",
  CBIN: "Central Bank of India",
  IOBA: "Indian Overseas Bank",
  PSIB: "Punjab and Sind Bank",
  SRCB: "Saraswat Bank",
  CIUB: "City Union Bank",
  AUBL: "AU Small Finance Bank",
  ESFB: "Equitas Small Finance Bank",
  USFB: "Ujjivan Small Finance Bank",
  JSFB: "Jana Small Finance Bank",
};

const INDIAN_BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
  "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda",
  "Canara Bank", "Union Bank of India", "Bank of India", "Yes Bank",
  "IndusInd Bank", "Federal Bank", "RBL Bank", "IDFC First Bank",
  "Bandhan Bank", "IDBI Bank", "Jammu & Kashmir Bank", "Karnataka Bank",
  "Karur Vysya Bank", "South Indian Bank", "DCB Bank", "Tamilnad Mercantile Bank",
  "UCO Bank", "Bank of Maharashtra", "Central Bank of India",
  "Indian Bank", "Indian Overseas Bank", "Punjab and Sind Bank",
  "Saraswat Bank", "City Union Bank", "AU Small Finance Bank",
  "Equitas Small Finance Bank", "Ujjivan Small Finance Bank",
  "Jana Small Finance Bank", "ESAF Small Finance Bank",
  "Airtel Payments Bank", "India Post Payments Bank", "Fino Payments Bank",
].sort();

const BUSINESS_TYPE_LABELS: Record<HotelBusinessType, string> = {
  PROPRIETORSHIP:  "Proprietorship",
  PARTNERSHIP:     "Partnership",
  LLP:             "LLP (Limited Liability Partnership)",
  PRIVATE_LIMITED: "Private Limited Company",
  PUBLIC_LIMITED:  "Public Limited Company",
  HUF:             "HUF (Hindu Undivided Family)",
};

const RELATIONSHIP_DOC_TYPES = [
  { value: "UTILITY_BILL",      label: "Utility Bill (Electricity / Water / Gas / Broadband — within 60–90 days)" },
  { value: "GST_CERTIFICATE",   label: "GST Certificate" },
  { value: "TRADE_LICENSE",     label: "Trade License" },
  { value: "GUMASTA",           label: "Gumasta / Shop & Establishment Certificate" },
  { value: "UDYAM",             label: "Udyam Registration" },
  { value: "TOURISM_CERT",      label: "Tourism Certificate" },
  { value: "FIRE_CERT",         label: "Fire Certificate (for hotels/commercial properties)" },
  { value: "COMPLETION_CERT",   label: "Building Completion Certificate (if available)" },
];

const OWNERSHIP_TYPES = [
  { value: "OWNED",   label: "Owned Property (Individual ownership)" },
  { value: "LEASED",  label: "Leased Property (Rented/leased premises)" },
  { value: "MANAGED", label: "Managed Property (Third party managed premises)" },
];

const OWNERSHIP_DOC_TYPES: Record<string, { value: string; label: string }[]> = {
  OWNED: [
    { value: "PROPERTY_REGISTRATION", label: "Property Registration Document" },
    { value: "SALE_DEED",             label: "Sale Deed" },
    { value: "LAND_DOCUMENT",         label: "Land Document (Khasra / Khatami)" },
  ],
  LEASED: [
    { value: "LEASE_AGREEMENT",       label: "Lease Agreement" },
    { value: "LEAVE_LICENSE",         label: "Leave & License Agreement (must be valid & signed)" },
  ],
  MANAGED: [
    { value: "MANAGEMENT_AGREEMENT",  label: "Management Agreement" },
  ],
};

const ACCOUNT_NUMBER_RE = /^\d{6,20}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FinanceHotelData = {
  id: number;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  bank_consent_given: boolean;
  gstin_number: string | null;
  pan_number: string | null;
  business_type: HotelBusinessType | null;
  msme_number: string | null;
  property_documents: Record<string, string> | null;
  relationship_doc_type: string | null;
  ownership_type: string | null;
  id_proof_type: string | null;
};

// ── UI components ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </Label>
  );
}

// Accordion section
function Section({
  number,
  title,
  description,
  expanded,
  onToggle,
  children,
  complete,
}: {
  number: number;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  complete?: boolean;
}) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 text-left rounded-t-[inherit] hover:bg-neutral-50/50 transition-colors"
      >
        {/* Number indicator */}
        <div className={cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-colors",
          complete
            ? "bg-emerald-500 text-white"
            : expanded
              ? "bg-primary-500 text-white"
              : "bg-neutral-100 text-neutral-500"
        )}>
          {complete ? <CheckIcon size={12} weight="bold" /> : number}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800">{title}</p>
          <p className="text-xs text-neutral-600/90 mt-0.5">{description}</p>
        </div>

        <div className="shrink-0 text-neutral-400 mt-1">
          {expanded ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-neutral-100">
          {children}
        </div>
      )}
    </Card>
  );
}

// Document upload card
function DocumentCard({
  hotelId,
  docKey,
  label,
  description,
  required,
  url,
  onUpdate,
}: {
  hotelId: number;
  docKey: string;
  label: string;
  description: string;
  required: boolean;
  url?: string;
  onUpdate: (docKey: string, url: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("document", file);
    const result = await uploadFinanceDocument(hotelId, docKey, fd);
    setUploading(false);
    e.target.value = "";
    if (result.url) onUpdate(docKey, result.url);
  }

  async function handleRemove() {
    setRemoving(true);
    await removeFinanceDocument(hotelId, docKey);
    setRemoving(false);
    onUpdate(docKey, null);
  }

  const fileName = url ? url.split("/").pop()?.split("?")[0] : null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4">
      <div className={cn(
        "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        url ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"
      )}>
        {url ? <CheckCircleIcon size={16} weight="fill" /> : <FileIcon size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-semibold text-neutral-800">{label}</p>
          {required && !url && (
            <span className="text-[10px] font-medium text-red-500 bg-red-50 rounded-full px-1.5 py-0.5">Required</span>
          )}
          {url && (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">Uploaded</span>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 leading-snug">{description}</p>
        {url && fileName && (
          <p className="text-[10px] text-neutral-500 mt-1 truncate">📄 {decodeURIComponent(fileName)}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {url ? (
          <button
            type="button"
            disabled={removing}
            onClick={handleRemove}
            aria-label={`Remove ${label}`}
            className="size-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
          >
            <TrashIcon size={12} aria-hidden="true" />
          </button>
        ) : null}

        <input ref={ref} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className={cn(
            "flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60",
            url
              ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              : "bg-primary-500 text-white hover:bg-primary-600"
          )}
        >
          <UploadSimpleIcon size={11} weight="bold" />
          {uploading ? "Uploading…" : url ? "Replace" : "Upload"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinanceTab({ hotel }: { hotel: FinanceHotelData }) {
  const router = useRouter();
  const [state, formAction] = useActionState<FinanceState, FormData>(
    saveFinance.bind(null, hotel.id),
    {}
  );

  // Navigation is handled by server-side redirect in finance-actions.ts

  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));
  function toggle(n: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  // ── Documents (shared by Section 1's bank proof + Section 3) ─────────────
  const [docs, setDocs] = useState<Record<string, string>>(
    (hotel.property_documents as Record<string, string> | null) ?? {}
  );

  function handleDocUpdate(docKey: string, url: string | null) {
    setDocs((prev) => {
      const next = { ...prev };
      if (url) next[docKey] = url; else delete next[docKey];
      return next;
    });
    router.refresh();
  }

  // ── Section 1: Bank ──────────────────────────────────────────────────────
  const [accountNumber,        setAccountNumber]        = useState(hotel.bank_account_number ?? "");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode,             setIfscCode]             = useState(hotel.bank_ifsc_code ?? "");
  const [bankName,             setBankName]             = useState(hotel.bank_name ?? "");
  const [consentGiven,         setConsentGiven]         = useState(hotel.bank_consent_given ?? false);

  // Auto-fill bank name from IFSC prefix
  useEffect(() => {
    if (ifscCode.length >= 4) {
      const mapped = IFSC_BANK_MAP[ifscCode.substring(0, 4).toUpperCase()];
      if (mapped) setBankName(mapped);
    }
  }, [ifscCode]);

  const accountMismatch =
    confirmAccountNumber.length > 0 && confirmAccountNumber !== accountNumber;

  const accountNumberError =
    accountNumber.length > 0 && !ACCOUNT_NUMBER_RE.test(accountNumber)
      ? "Account number must be 6-20 digits, numbers only."
      : null;
  const ifscError =
    ifscCode.length > 0 && !IFSC_RE.test(ifscCode)
      ? "Invalid IFSC code format. Example: SBIN0001234"
      : null;

  const bankSectionComplete =
    !!accountNumber && !accountNumberError &&
    !!ifscCode && !ifscError &&
    !!bankName && consentGiven && !!docs.bank_proof;

  // ── Section 2: Tax / MSME ────────────────────────────────────────────────
  const [gstRegistered,  setGstRegistered]  = useState<boolean | null>(hotel.gstin_number ? true : null);
  const [gstinNumber,    setGstinNumber]    = useState(hotel.gstin_number ?? "");
  const [panNumber,      setPanNumber]      = useState(hotel.pan_number   ?? "");
  const [businessType,   setBusinessType]   = useState<string>(hotel.business_type ?? "");
  const [msmeRegistered, setMsmeRegistered] = useState<boolean | null>(hotel.msme_number ? true : null);
  const [msmeNumber,     setMsmeNumber]     = useState(hotel.msme_number  ?? "");

  const taxSectionComplete = !!panNumber && !!businessType;

  // ── Section 3: Documents ─────────────────────────────────────────────────
  const [relDocType, setRelDocType] = useState(hotel.relationship_doc_type ?? "");
  const [ownershipType, setOwnershipType] = useState(hotel.ownership_type ?? "");
  const [ownershipDocType, setOwnershipDocType] = useState(hotel.id_proof_type ?? "");

  function handleOwnershipTypeChange(value: string) {
    setOwnershipType(value);
    setOwnershipDocType("");
  }

  const docsSectionComplete = !!docs.address_proof && !!docs.ownership_proof;

  function handleSubmit(e: React.FormEvent) {
    if (accountMismatch || accountNumberError || ifscError) {
      e.preventDefault();
      setExpanded((prev) => new Set([...prev, 1]));
    }
  }

  return (
    <form id="wizard-form" action={formAction} onSubmit={handleSubmit} className="space-y-4 py-5">
      {/* ── Hidden inputs ── */}
      <input type="hidden" name="bank_account_number" value={accountNumber} />
      <input type="hidden" name="bank_ifsc_code"      value={ifscCode} />
      <input type="hidden" name="bank_name"           value={bankName} />
      <input type="hidden" name="bank_consent_given"  value={consentGiven ? "yes" : "no"} />
      <input type="hidden" name="gstin_number"        value={gstRegistered ? gstinNumber : ""} />
      <input type="hidden" name="pan_number"          value={panNumber} />
      <input type="hidden" name="business_type"       value={businessType} />
      <input type="hidden" name="msme_number"         value={msmeRegistered ? msmeNumber : ""} />
      <input type="hidden" name="relationship_doc_type" value={relDocType} />
      <input type="hidden" name="ownership_type"       value={ownershipType} />
      <input type="hidden" name="id_proof_type"        value={ownershipDocType} />

      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 flex items-center gap-2">
          <WarningCircleIcon size={14} className="shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      {/* ── 1. Bank Account Information ─────────────────────────────────── */}
      <Section
        number={1}
        title="Bank Account Information"
        description="Please provide your bank details to receive payouts without delay"
        expanded={expanded.has(1)}
        onToggle={() => toggle(1)}
        complete={bankSectionComplete}
      >
        <div className="px-5 py-5 space-y-4">
          {/* Account number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required htmlFor="fin-account-number">Bank Account Number</FieldLabel>
              <Input
                id="fin-account-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="1234567890123456"
                type="password"
                aria-invalid={!!accountNumberError}
                className={accountNumberError ? "border-red-300 focus:ring-red-200 focus:border-red-300" : ""}
              />
              {accountNumberError && (
                <p className="text-[10px] text-red-500 mt-1">{accountNumberError}</p>
              )}
            </div>
            <div>
              <FieldLabel required htmlFor="fin-confirm-account-number">Re-Enter Bank Account Number</FieldLabel>
              <Input
                id="fin-confirm-account-number"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="1234567890123456"
                className={accountMismatch ? "border-red-300 focus:ring-red-200 focus:border-red-300" : ""}
              />
              {accountMismatch && (
                <p className="text-[10px] text-red-500 mt-1">Account numbers do not match</p>
              )}
            </div>
          </div>

          {/* IFSC + Bank name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required htmlFor="fin-ifsc">Bank IFSC Code</FieldLabel>
              <p className="text-[10px] text-neutral-400 mb-1.5 leading-snug">
                You can find this on your cheque book or bank statement
              </p>
              <Input
                id="fin-ifsc"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
                aria-invalid={!!ifscError}
                className={ifscError ? "border-red-300 focus:ring-red-200 focus:border-red-300" : ""}
              />
              {ifscError && (
                <p className="text-[10px] text-red-500 mt-1">{ifscError}</p>
              )}
            </div>
            <div>
              <FieldLabel required htmlFor="fin-bank-name">Bank Name</FieldLabel>
              <SearchSelect
                id="fin-bank-name"
                options={INDIAN_BANKS}
                value={bankName}
                onChange={setBankName}
                placeholder="Select your bank"
                searchPlaceholder="Search bank…"
              />
            </div>
          </div>

          {/* Passbook / cancelled cheque — proof of account ownership */}
          <DocumentCard
            hotelId={hotel.id}
            docKey="bank_proof"
            label="Passbook / Cancelled Cheque"
            description="Upload a photo of your bank passbook's first page or a cancelled cheque, showing your name and account number"
            required
            url={docs.bank_proof}
            onUpdate={handleDocUpdate}
          />

          {/* Consent declaration */}
          <div
            role="checkbox"
            aria-checked={consentGiven}
            tabIndex={0}
            onClick={() => setConsentGiven((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setConsentGiven((v) => !v); }
            }}
            className={cn(
              "flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors select-none",
              consentGiven ? "border-emerald-400 bg-emerald-50/60" : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-300"
            )}
          >
            <div className={cn(
              "size-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
              consentGiven ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white"
            )}>
              {consentGiven && <CheckIcon size={10} weight="bold" className="text-white" />}
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              I confirm that the bank account details provided above are correct and I authorise
              DreamsYatri to use this account for property payout settlements.
            </p>
          </div>
        </div>
      </Section>

      {/* ── 2. Tax, MSME and Registration Information ────────────────────── */}
      <Section
        number={2}
        title="Tax, MSME and Registration Information"
        description="These tax details will be used for invoicing and statutory compliance"
        expanded={expanded.has(2)}
        onToggle={() => toggle(2)}
        complete={taxSectionComplete}
      >
        <div className="px-5 py-5 space-y-4">
          {/* PAN + Business type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required htmlFor="fin-pan">PAN Number</FieldLabel>
              <Input
                id="fin-pan"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
              />
            </div>
            <div>
              <FieldLabel required htmlFor="fin-business-type">Business Type</FieldLabel>
              <SearchSelect
                id="fin-business-type"
                value={businessType}
                onChange={setBusinessType}
                options={Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                placeholder="Select business type"
                showSearch={false}
              />
            </div>
          </div>

          {/* GST */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between mb-3">
              <div>
                <Label id="fin-gst-registered-label">GST Registered?</Label>
                <p className="text-[10px] text-neutral-400 mt-0.5">Required if your annual turnover exceeds ₹20 lakhs</p>
              </div>
              <div role="group" aria-labelledby="fin-gst-registered-label" className="flex self-start sm:self-auto shrink-0 rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={gstRegistered === false}
                  onClick={() => setGstRegistered(false)}
                  className={cn("px-4 py-1.5 transition-colors", gstRegistered === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  No
                </button>
                <div className="w-px bg-neutral-200" />
                <button
                  type="button"
                  aria-pressed={gstRegistered === true}
                  onClick={() => setGstRegistered(true)}
                  className={cn("px-4 py-1.5 transition-colors", gstRegistered === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  Yes
                </button>
              </div>
            </div>
            {gstRegistered === true && (
              <div>
                <FieldLabel htmlFor="fin-gstin">GSTIN Number</FieldLabel>
                <Input
                  id="fin-gstin"
                  value={gstinNumber}
                  onChange={(e) => setGstinNumber(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
            )}
          </div>

          {/* MSME */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between mb-3">
              <div>
                <Label id="fin-msme-registered-label">MSME / Udyam Registered?</Label>
                <p className="text-[10px] text-neutral-400 mt-0.5">Optional — helps unlock government scheme benefits</p>
              </div>
              <div role="group" aria-labelledby="fin-msme-registered-label" className="flex self-start sm:self-auto shrink-0 rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={msmeRegistered === false}
                  onClick={() => setMsmeRegistered(false)}
                  className={cn("px-4 py-1.5 transition-colors", msmeRegistered === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  No
                </button>
                <div className="w-px bg-neutral-200" />
                <button
                  type="button"
                  aria-pressed={msmeRegistered === true}
                  onClick={() => setMsmeRegistered(true)}
                  className={cn("px-4 py-1.5 transition-colors", msmeRegistered === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  Yes
                </button>
              </div>
            </div>
            {msmeRegistered === true && (
              <div>
                <FieldLabel htmlFor="fin-msme-number">MSME / Udyam Registration Number</FieldLabel>
                <Input
                  id="fin-msme-number"
                  value={msmeNumber}
                  onChange={(e) => setMsmeNumber(e.target.value)}
                  placeholder="UDYAM-XX-00-0000000"
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 3. Property Documents ─────────────────────────────────────────── */}
      <Section
        number={3}
        title="Property Documents"
        description="Provide necessary documents for verification and onboarding completion"
        expanded={expanded.has(3)}
        onToggle={() => toggle(3)}
        complete={docsSectionComplete}
      >
        <div className="px-5 py-5 space-y-5">
          <p className="text-[11px] text-neutral-500 mb-1">
            Upload clear scanned copies or photos. Accepted formats: PDF, JPG, PNG (max 10 MB each).
          </p>

          {/* Address cum Relationship Proof */}
          <div className="space-y-2">
            <FieldLabel required htmlFor="fin-rel-doc-type">
              Select Address cum Relationship Proof Document Type to Upload
            </FieldLabel>
            <SearchSelect
              id="fin-rel-doc-type"
              options={RELATIONSHIP_DOC_TYPES}
              value={relDocType}
              onChange={setRelDocType}
              placeholder="Select document type"
              searchPlaceholder="Search…"
            />
            {relDocType && (
              <DocumentCard
                hotelId={hotel.id}
                docKey="address_proof"
                label={RELATIONSHIP_DOC_TYPES.find((d) => d.value === relDocType)?.label ?? "Address Proof"}
                description="Upload the selected document type"
                required
                url={docs.address_proof}
                onUpdate={handleDocUpdate}
              />
            )}
          </div>

          {/* Business Ownership Type */}
          <div className="space-y-2">
            <FieldLabel required htmlFor="fin-ownership-type">Select Business Ownership Type</FieldLabel>
            <SearchSelect
              id="fin-ownership-type"
              options={OWNERSHIP_TYPES}
              value={ownershipType}
              onChange={handleOwnershipTypeChange}
              placeholder="Select ownership type"
              showSearch={false}
            />
            {ownershipType && (
              <SearchSelect
                options={OWNERSHIP_DOC_TYPES[ownershipType] ?? []}
                value={ownershipDocType}
                onChange={setOwnershipDocType}
                placeholder="Select document type"
                showSearch={false}
              />
            )}
            {ownershipType && ownershipDocType && (
              <DocumentCard
                hotelId={hotel.id}
                docKey="ownership_proof"
                label={OWNERSHIP_DOC_TYPES[ownershipType]?.find((d) => d.value === ownershipDocType)?.label ?? "Ownership Proof"}
                description="Upload the selected document type"
                required
                url={docs.ownership_proof}
                onUpdate={handleDocUpdate}
              />
            )}
          </div>
        </div>
      </Section>
    </form>
  );
}
