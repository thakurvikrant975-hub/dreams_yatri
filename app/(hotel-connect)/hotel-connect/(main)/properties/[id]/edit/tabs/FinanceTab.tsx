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

const DOCUMENT_TYPES = [
  {
    key: "property_deed",
    label: "Property Ownership Proof",
    description: "Property deed, sale deed, or lease agreement",
    required: true,
  },
  {
    key: "trade_license",
    label: "Trade License",
    description: "Business/trade license issued by local authority",
    required: true,
  },
  {
    key: "gst_certificate",
    label: "GST Certificate",
    description: "GST registration certificate (leave blank if not applicable)",
    required: false,
  },
  {
    key: "pan_card",
    label: "PAN Card",
    description: "PAN card of the owner or business entity",
    required: true,
  },
  {
    key: "id_proof",
    label: "Owner's Identity Proof",
    description: "Aadhaar card, passport, or voter ID",
    required: true,
  },
];

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
};

// ── UI components ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-neutral-600 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-800 placeholder:text-neutral-400",
        "focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 transition-colors",
        className
      )}
    />
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
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-neutral-50/50 transition-colors"
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
          <p className="text-[11px] text-neutral-400 mt-0.5">{description}</p>
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
    </div>
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
            className="size-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50"
          >
            <TrashIcon size={12} />
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

  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));
  function toggle(n: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
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

  const bankSectionComplete = !!accountNumber && !!ifscCode && !!bankName && consentGiven;

  // ── Section 2: Tax / MSME ────────────────────────────────────────────────
  const [gstRegistered,  setGstRegistered]  = useState<boolean | null>(hotel.gstin_number ? true : null);
  const [gstinNumber,    setGstinNumber]    = useState(hotel.gstin_number ?? "");
  const [panNumber,      setPanNumber]      = useState(hotel.pan_number   ?? "");
  const [businessType,   setBusinessType]   = useState<string>(hotel.business_type ?? "");
  const [msmeRegistered, setMsmeRegistered] = useState<boolean | null>(hotel.msme_number ? true : null);
  const [msmeNumber,     setMsmeNumber]     = useState(hotel.msme_number  ?? "");

  const taxSectionComplete = !!panNumber && !!businessType;

  // ── Section 3: Documents ─────────────────────────────────────────────────
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

  const requiredDocs = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.key);
  const docsSectionComplete = requiredDocs.every((k) => !!docs[k]);

  function handleSubmit(e: React.FormEvent) {
    if (accountMismatch) {
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

      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 flex items-center gap-2">
          <WarningCircleIcon size={14} className="shrink-0" />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Bank Account Number</FieldLabel>
              <TextInput
                value={accountNumber}
                onChange={setAccountNumber}
                placeholder="1234567890123456"
                type="password"
              />
            </div>
            <div>
              <FieldLabel required>Re-Enter Bank Account Number</FieldLabel>
              <TextInput
                value={confirmAccountNumber}
                onChange={setConfirmAccountNumber}
                placeholder="1234567890123456"
                className={accountMismatch ? "border-red-300 focus:ring-red-200 focus:border-red-300" : ""}
              />
              {accountMismatch && (
                <p className="text-[10px] text-red-500 mt-1">Account numbers do not match</p>
              )}
            </div>
          </div>

          {/* IFSC + Bank name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Bank IFSC Code</FieldLabel>
              <p className="text-[10px] text-neutral-400 mb-1.5 leading-snug">
                You can find this on your cheque book or bank statement
              </p>
              <TextInput
                value={ifscCode}
                onChange={(v) => setIfscCode(v.toUpperCase())}
                placeholder="HDFC0001234"
              />
            </div>
            <div>
              <FieldLabel required>Bank Name</FieldLabel>
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 pr-8 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 appearance-none"
              >
                <option value="">Select your bank from the list</option>
                {INDIAN_BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Consent declaration */}
          <div
            onClick={() => setConsentGiven((v) => !v)}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>PAN Number</FieldLabel>
              <TextInput
                value={panNumber}
                onChange={(v) => setPanNumber(v.toUpperCase())}
                placeholder="ABCDE1234F"
              />
            </div>
            <div>
              <FieldLabel required>Business Type</FieldLabel>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 pr-8 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 appearance-none"
              >
                <option value="">Select business type</option>
                {Object.entries(BUSINESS_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* GST */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-neutral-700">GST Registered?</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Required if your annual turnover exceeds ₹20 lakhs</p>
              </div>
              <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setGstRegistered(false)}
                  className={cn("px-4 py-1.5 transition-colors", gstRegistered === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  No
                </button>
                <div className="w-px bg-neutral-200" />
                <button
                  type="button"
                  onClick={() => setGstRegistered(true)}
                  className={cn("px-4 py-1.5 transition-colors", gstRegistered === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  Yes
                </button>
              </div>
            </div>
            {gstRegistered === true && (
              <div>
                <FieldLabel>GSTIN Number</FieldLabel>
                <TextInput
                  value={gstinNumber}
                  onChange={(v) => setGstinNumber(v.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
            )}
          </div>

          {/* MSME */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-neutral-700">MSME / Udyam Registered?</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Optional — helps unlock government scheme benefits</p>
              </div>
              <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMsmeRegistered(false)}
                  className={cn("px-4 py-1.5 transition-colors", msmeRegistered === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  No
                </button>
                <div className="w-px bg-neutral-200" />
                <button
                  type="button"
                  onClick={() => setMsmeRegistered(true)}
                  className={cn("px-4 py-1.5 transition-colors", msmeRegistered === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}
                >
                  Yes
                </button>
              </div>
            </div>
            {msmeRegistered === true && (
              <div>
                <FieldLabel>MSME / Udyam Registration Number</FieldLabel>
                <TextInput
                  value={msmeNumber}
                  onChange={setMsmeNumber}
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
        <div className="px-5 py-5 space-y-3">
          <p className="text-[11px] text-neutral-500 mb-1">
            Upload clear scanned copies or photos. Accepted formats: PDF, JPG, PNG (max 10 MB each).
          </p>
          {DOCUMENT_TYPES.map((doc) => (
            <DocumentCard
              key={doc.key}
              hotelId={hotel.id}
              docKey={doc.key}
              label={doc.label}
              description={doc.description}
              required={doc.required}
              url={docs[doc.key]}
              onUpdate={handleDocUpdate}
            />
          ))}
        </div>
      </Section>
    </form>
  );
}
