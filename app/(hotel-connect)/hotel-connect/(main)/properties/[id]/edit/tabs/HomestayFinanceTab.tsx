"use client";

import { useActionState, useState, useRef } from "react";
import { saveHomestayFinance, type HomestayFinanceState } from "./homestay-finance-actions";
import { uploadFinanceDocument, removeFinanceDocument } from "./finance-actions";
import { cn } from "@/app/lib/utils";
import {
  CheckIcon, CaretDownIcon, CaretUpIcon,
  UploadSimpleIcon, TrashIcon, FileIcon,
  CheckCircleIcon, EyeIcon, EyeSlashIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/app/components/ui/Card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HomestayFinanceData = {
  id: number;
  // address for display
  address:    string | null;
  city:       string | null;
  state:      string | null;
  country:    string | null;
  pincode:    string | null;
  // ownership
  ownership_type:        string | null;
  has_registration_doc:  boolean | null;
  relationship_doc_type: string | null;
  // id proof
  id_proof_type: string | null;
  // banking
  bank_account_number: string | null;
  bank_ifsc_code:      string | null;
  bank_name:           string | null;
  gstin_number:        string | null;
  pan_number:          string | null;
  tan_number:          string | null;
  // docs
  property_documents:  Record<string, string> | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const OWNERSHIP_TYPES = [
  { value: "SELF",     label: "I own the property" },
  { value: "COMPANY",  label: "My company owns the property" },
  { value: "SPOUSE",   label: "My spouse owns the property" },
  { value: "RELATIVE", label: "My relative owns the property" },
  { value: "FRIEND",   label: "My friend owns the property" },
];

const THIRD_PARTY_TYPES = new Set(["SPOUSE", "RELATIVE", "FRIEND"]);

const RELATIONSHIP_DOC_TYPES = [
  { value: "NOC_EBILL",           label: "3rd party NOC + E-bill" },
  { value: "NOC",                 label: "NOC (No Objection Certificate)" },
  { value: "ELECTRICITY_BILL",    label: "Electricity Bill" },
  { value: "RELATIONSHIP_CERT",   label: "Relationship Certificate" },
  { value: "RENT_AGREEMENT",      label: "Rent Agreement" },
];

const ID_PROOF_TYPES = [
  { value: "AADHAAR",  label: "Aadhaar Card" },
  { value: "PAN",      label: "PAN Card" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DL",       label: "Driving License" },
];

const IFSC_BANK_MAP: Record<string, string> = {
  SBIN: "State Bank of India",  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",           UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",       CNRB: "Canara Bank",
  UBIN: "Union Bank of India",  BKID: "Bank of India",
  YESB: "Yes Bank",             INDB: "IndusInd Bank",
  FDRL: "Federal Bank",         RATN: "RBL Bank",
  IDFB: "IDFC First Bank",      BDBL: "Bandhan Bank",
  IBKL: "IDBI Bank",            JAKA: "Jammu & Kashmir Bank",
};

const INDIAN_BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
  "Kotak Mahindra Bank", "Punjab National Bank", "Bank of Baroda",
  "Canara Bank", "Union Bank of India", "Bank of India", "Yes Bank",
  "IndusInd Bank", "Federal Bank", "RBL Bank", "IDFC First Bank",
  "Bandhan Bank", "IDBI Bank", "Jammu & Kashmir Bank", "Karnataka Bank",
  "Karur Vysya Bank", "South Indian Bank", "DCB Bank", "UCO Bank",
  "Bank of Maharashtra", "Central Bank of India", "Indian Bank",
  "Indian Overseas Bank", "Punjab and Sind Bank", "AU Small Finance Bank",
  "Equitas Small Finance Bank", "Ujjivan Small Finance Bank",
].sort();

// ── UI helpers ────────────────────────────────────────────────────────────────

function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </Label>
  );
}

function SelectInput({
  value, onChange, placeholder, options,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <SearchSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? "Select…"}
      searchPlaceholder="Search…"
    />
  );
}

function YesNoButtons({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div role="group" className="flex self-start sm:self-auto rounded-lg border border-neutral-200 overflow-hidden shrink-0 text-xs font-medium">
      <button type="button" onClick={() => onChange(false)} aria-pressed={value === false}
        className={cn("px-4 py-1.5 transition-colors",
          value === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
        No
      </button>
      <div className="w-px bg-neutral-200" />
      <button type="button" onClick={() => onChange(true)} aria-pressed={value === true}
        className={cn("px-4 py-1.5 transition-colors",
          value === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
        Yes
      </button>
    </div>
  );
}

// Collapsible accordion section
function Section({
  number, title, description, expanded, onToggle, children, complete,
}: {
  number: number; title: string; description: string;
  expanded: boolean; onToggle: () => void;
  children: React.ReactNode; complete?: boolean;
}) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <button type="button" onClick={onToggle}
        className="w-full flex items-start gap-4 px-5 py-4 text-left rounded-t-[inherit] hover:bg-neutral-50/50 transition-colors">
        <div className={cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-colors",
          complete ? "bg-emerald-500 text-white" : expanded ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-500",
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
      {expanded && <div className="border-t border-neutral-100">{children}</div>}
    </Card>
  );
}

// Upload card — reuses the same R2 upload actions as FinanceTab
function UploadCard({
  hotelId, docKey, label, hint, required, url, onUpdate, note,
}: {
  hotelId: number; docKey: string; label: string;
  hint?: string; required?: boolean;
  url?: string; onUpdate: (key: string, url: string | null) => void;
  note?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing,  setRemoving]  = useState(false);

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

  const fileName = url ? decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "") : null;

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          url ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400",
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
          {hint && <p className="text-[11px] text-neutral-400 leading-snug">{hint}</p>}
          {url && fileName && (
            <p className="text-[10px] text-neutral-500 mt-1 truncate">📄 {fileName}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {url && (
            <button type="button" disabled={removing} onClick={handleRemove} aria-label={`Remove ${label}`}
              className="size-7 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50">
              <TrashIcon size={12} aria-hidden="true" />
            </button>
          )}
          <input ref={ref} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} />
          <button type="button" disabled={uploading} onClick={() => ref.current?.click()}
            className={cn(
              "flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60",
              url
                ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                : "bg-primary-500 text-white hover:bg-primary-600",
            )}>
            <UploadSimpleIcon size={11} weight="bold" />
            {uploading ? "Uploading…" : url ? "Replace" : "Upload"}
          </button>
        </div>
      </div>

      {/* Drop zone (visual only) */}
      {!url && (
        <div
          onClick={() => ref.current?.click()}
          className="mx-4 mb-4 border-2 border-dashed border-neutral-200 rounded-lg py-5 flex flex-col items-center gap-1.5 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
        >
          <UploadSimpleIcon size={18} className="text-neutral-300" />
          <p className="text-xs text-neutral-400">Drag & Drop the {label}</p>
          <p className="text-[10px] text-neutral-300">Upload PDF/PNG/JPG/JPEG files of up to 15 MB</p>
        </div>
      )}

      {note && (
        <p className="px-4 pb-3 text-[11px] text-neutral-400 leading-relaxed">{note}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomestayFinanceTab({ hotel }: { hotel: HomestayFinanceData }) {
  const boundAction = saveHomestayFinance.bind(null, hotel.id);
  const [state, formAction] = useActionState<HomestayFinanceState, FormData>(boundAction, {});

  // Which section is open (null = all closed)
  const [open, setOpen] = useState<number | null>(1);
  function toggleSection(n: number) { setOpen((prev) => (prev === n ? null : n)); }

  // ── Section 1: Ownership Details ──────────────────────────────────────────
  const [ownershipType,      setOwnershipType]      = useState(hotel.ownership_type        ?? "");
  const [hasRegDoc,          setHasRegDoc]           = useState<boolean | null>(hotel.has_registration_doc);
  const [relDocType,         setRelDocType]          = useState(hotel.relationship_doc_type ?? "");
  const [docs,               setDocs]                = useState<Record<string, string>>(
    (hotel.property_documents as Record<string, string> | null) ?? {},
  );

  function updateDoc(key: string, url: string | null) {
    setDocs((prev) => {
      const next = { ...prev };
      if (url) next[key] = url; else delete next[key];
      return next;
    });
  }

  const isThirdParty = THIRD_PARTY_TYPES.has(ownershipType);
  const thirdPartyLabel = OWNERSHIP_TYPES.find((o) => o.value === ownershipType)?.label ?? "owner's";

  // ── Section 2: ID Proof ────────────────────────────────────────────────────
  const [idProofType, setIdProofType] = useState(hotel.id_proof_type ?? "");

  // ── Section 3: Banking Details ─────────────────────────────────────────────
  const [accountNo,    setAccountNo]    = useState(hotel.bank_account_number ?? "");
  const [accountConf,  setAccountConf]  = useState("");
  const [showAcct,     setShowAcct]     = useState(false);
  const [ifsc,         setIfsc]         = useState(hotel.bank_ifsc_code ?? "");
  const [bankName,     setBankName]     = useState(hotel.bank_name      ?? "");
  const [hasGstin,     setHasGstin]     = useState(!!hotel.gstin_number);
  const [gstin,        setGstin]        = useState(hotel.gstin_number   ?? "");
  const [panNumber,    setPanNumber]    = useState(hotel.pan_number     ?? "");
  const [hasTan,       setHasTan]       = useState(!!hotel.tan_number);
  const [tanNumber,    setTanNumber]    = useState(hotel.tan_number     ?? "");

  // Auto-detect bank from IFSC
  function handleIfsc(v: string) {
    const upper = v.toUpperCase().slice(0, 11);
    setIfsc(upper);
    const prefix = upper.slice(0, 4);
    if (IFSC_BANK_MAP[prefix]) setBankName(IFSC_BANK_MAP[prefix]);
  }

  // Auto-fill PAN from GSTIN (chars 2-11) — convenience only; PAN stays freely editable.
  function handleGstin(v: string) {
    const upper = v.toUpperCase().slice(0, 15);
    setGstin(upper);
    if (upper.length >= 12) setPanNumber(upper.slice(2, 12));
  }

  // Completeness checks for section indicators
  // 3rd-party with no registration doc: section is complete once hasRegDoc is answered
  const sec1Complete = !!ownershipType && (
    isThirdParty && hasRegDoc === false
      ? true
      : !!docs["registration_doc"]
  );
  const sec2Complete = !!idProofType && !!docs["id_proof"];
  // PAN is required to submit for review (see review-actions.submitForReview),
  // so it must factor into this section's own "complete" indicator too.
  const sec3Complete = !!accountNo && !!ifsc && !!bankName && !!panNumber;

  // Property address string for the upload note
  const addressParts = [hotel.address, hotel.city, hotel.state, hotel.country].filter(Boolean);
  const addressStr = addressParts.join(", ") + (hotel.pincode ? `, Pincode - ${hotel.pincode}` : "");

  return (
    <>
      <form
        id="wizard-form"
        action={formAction}
        className="space-y-4 py-5"
        onSubmit={(e) => {
          if (accountConf !== accountNo) {
            e.preventDefault();
            // Section 3 may be collapsed (e.g. a returning host who never
            // reopened it) — force it open so the mismatch message below
            // is actually visible instead of silently blocking the submit.
            setOpen(3);
            return;
          }
        }}
      >
        {/* Hidden form fields */}
        <input type="hidden" name="ownership_type"        value={ownershipType} />
        <input type="hidden" name="has_registration_doc"  value={hasRegDoc === true ? "yes" : hasRegDoc === false ? "no" : ""} />
        <input type="hidden" name="relationship_doc_type" value={relDocType} />
        <input type="hidden" name="id_proof_type"         value={idProofType} />
        <input type="hidden" name="bank_account_number"   value={accountNo} />
        <input type="hidden" name="bank_account_confirm"  value={accountConf} />
        <input type="hidden" name="bank_ifsc_code"        value={ifsc} />
        <input type="hidden" name="bank_name"             value={bankName} />
        <input type="hidden" name="gstin_number"          value={hasGstin ? gstin : ""} />
        <input type="hidden" name="pan_number"            value={panNumber} />
        <input type="hidden" name="tan_number"            value={hasTan ? tanNumber : ""} />

        {state.error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 mb-3">
            {state.error}
          </div>
        )}

        {/* ── Section 1: Ownership Details ──────────────────────────────────── */}
        <Section
          number={1}
          title="Ownership Details"
          description="Tell us who owns the property and upload proof of ownership"
          expanded={open === 1}
          onToggle={() => toggleSection(1)}
          complete={sec1Complete}
        >
          <div className="p-5 space-y-5">
            {/* Ownership type */}
            <div>
              <FieldLabel required>Types of Property Ownership</FieldLabel>
              <p className="text-[11px] text-neutral-400 mb-2">Choose the ownership type from below options.</p>
              <SelectInput
                value={ownershipType}
                onChange={(v) => { setOwnershipType(v); setHasRegDoc(null); }}
                options={OWNERSHIP_TYPES}
                placeholder="Select ownership type"
              />
            </div>

            {ownershipType && (
              <>
                {/* 3rd-party: ask if they have the registration doc */}
                {isThirdParty && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:justify-between">
                    <p className="text-xs text-neutral-700">
                      Do you have the registration document of your {thirdPartyLabel.toLowerCase().replace("my ", "").replace(" owns the property", "")}'s property?
                    </p>
                    <YesNoButtons value={hasRegDoc} onChange={setHasRegDoc} />
                  </div>
                )}

                {/* Show registration doc upload: always for self/company, only if "Yes" for 3rd party */}
                {(!isThirdParty || hasRegDoc === true) && (
                  <div>
                    {addressStr && (
                      <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          Your property address: <span className="font-medium">{addressStr}</span>
                        </p>
                      </div>
                    )}
                    <UploadCard
                      hotelId={hotel.id}
                      docKey="registration_doc"
                      label="Registration Document"
                      hint="Property deed, sale deed, or registration certificate"
                      required
                      url={docs["registration_doc"]}
                      onUpdate={updateDoc}
                    />
                  </div>
                )}

                {/* 3rd-party: relationship document */}
                {isThirdParty && (
                  <>
                    <div>
                      <FieldLabel>Relationship Document Type</FieldLabel>
                      <p className="text-[11px] text-neutral-400 mb-2">Choose the document type from below options.</p>
                      <SelectInput
                        value={relDocType}
                        onChange={setRelDocType}
                        options={RELATIONSHIP_DOC_TYPES}
                        placeholder="Select document type"
                      />
                    </div>
                    <UploadCard
                      hotelId={hotel.id}
                      docKey="relationship_doc"
                      label="Relationship Document"
                      hint="NOC, electricity bill, or relationship certificate"
                      url={docs["relationship_doc"]}
                      onUpdate={updateDoc}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </Section>

        {/* ── Section 2: ID Proof ────────────────────────────────────────────── */}
        <Section
          number={2}
          title="ID Proof"
          description="Upload your identity proof for verification"
          expanded={open === 2}
          onToggle={() => toggleSection(2)}
          complete={sec2Complete}
        >
          <div className="p-5 space-y-5">
            <div>
              <FieldLabel required>ID Type</FieldLabel>
              <p className="text-[11px] text-neutral-400 mb-2">Upload your ID Proof for verification.</p>
              <SelectInput
                value={idProofType}
                onChange={setIdProofType}
                options={ID_PROOF_TYPES}
                placeholder="Select"
              />
            </div>

            {idProofType && (
              <UploadCard
                hotelId={hotel.id}
                docKey="id_proof"
                label="ID Proof"
                hint="Upload the side with the number visible on it."
                required
                url={docs["id_proof"]}
                onUpdate={updateDoc}
                note="Upload PDF/PNG/JPG/JPEG files of up to 15 MB"
              />
            )}
          </div>
        </Section>

        {/* ── Section 3: Banking Details ─────────────────────────────────────── */}
        <Section
          number={3}
          title="Banking Details"
          description="Add your bank account, tax identifiers for payouts"
          expanded={open === 3}
          onToggle={() => toggleSection(3)}
          complete={sec3Complete}
        >
          <div className="p-5 space-y-6">

            {/* Bank account */}
            <div className="space-y-4">
              <Label className="flex items-center gap-1.5 normal-case tracking-normal">
                <LockSimpleIcon size={12} className="text-neutral-400" />
                Bank Account
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel required htmlFor="hfin-account-number">Account Number</FieldLabel>
                  <div className="relative">
                    <Input
                      id="hfin-account-number"
                      type={showAcct ? "text" : "password"}
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value)}
                      placeholder="Enter Account Number"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAcct((v) => !v)}
                      aria-label={showAcct ? "Hide account number" : "Show account number"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showAcct ? <EyeSlashIcon size={14} aria-hidden="true" /> : <EyeIcon size={14} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div>
                  <FieldLabel required htmlFor="hfin-confirm-account-number">Re-enter Account Number</FieldLabel>
                  <Input
                    id="hfin-confirm-account-number"
                    value={accountConf}
                    onChange={(e) => setAccountConf(e.target.value)}
                    placeholder="Enter Account Number"
                  />
                  {(accountConf || accountNo) && accountConf !== accountNo && (
                    <p className="text-[11px] text-red-500 mt-1">Account numbers do not match</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="hfin-ifsc">IFSC Code</FieldLabel>
                  <Input
                    id="hfin-ifsc"
                    value={ifsc}
                    onChange={(e) => handleIfsc(e.target.value)}
                    placeholder="Enter IFSC Code"
                    maxLength={11}
                    className="uppercase"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="hfin-bank-name">Bank Name</FieldLabel>
                  <SearchSelect
                    id="hfin-bank-name"
                    options={INDIAN_BANKS}
                    value={bankName}
                    onChange={setBankName}
                    placeholder="Select your bank"
                    searchPlaceholder="Search bank…"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-neutral-100" />

            {/* PAN — always required for payouts/tax reporting, regardless of GSTIN */}
            <div>
              <FieldLabel required htmlFor="hfin-pan">PAN Number</FieldLabel>
              <Input
                id="hfin-pan"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="uppercase"
              />
            </div>

            <div className="h-px bg-neutral-100" />

            {/* GSTIN (optional) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:justify-between">
                <Label id="hfin-has-gstin-label">Do you have a GSTIN?</Label>
                <div role="group" aria-labelledby="hfin-has-gstin-label" className="flex self-start sm:self-auto rounded-lg border border-neutral-200 overflow-hidden shrink-0 text-xs font-medium">
                  <button type="button" aria-pressed={!hasGstin} onClick={() => { setHasGstin(false); setGstin(""); }}
                    className={cn("px-4 py-1.5 transition-colors",
                      !hasGstin ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
                    No
                  </button>
                  <div className="w-px bg-neutral-200" />
                  <button type="button" aria-pressed={hasGstin} onClick={() => setHasGstin(true)}
                    className={cn("px-4 py-1.5 transition-colors",
                      hasGstin ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
                    Yes
                  </button>
                </div>
              </div>

              {hasGstin && (
                <div>
                  <FieldLabel htmlFor="hfin-gstin">Enter GSTIN</FieldLabel>
                  <Input
                    id="hfin-gstin"
                    value={gstin}
                    onChange={(e) => handleGstin(e.target.value)}
                    placeholder="Enter the 15-digit GSTIN"
                    maxLength={15}
                    className="uppercase"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">This will auto-fill your PAN above — you can still edit it.</p>
                </div>
              )}
            </div>

            <div className="h-px bg-neutral-100" />

            {/* TAN */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 sm:justify-between">
                <Label id="hfin-has-tan-label">Do you have a TAN?</Label>
                <div role="group" aria-labelledby="hfin-has-tan-label" className="flex self-start sm:self-auto rounded-lg border border-neutral-200 overflow-hidden shrink-0 text-xs font-medium">
                  <button type="button" aria-pressed={!hasTan} onClick={() => { setHasTan(false); setTanNumber(""); }}
                    className={cn("px-4 py-1.5 transition-colors",
                      !hasTan ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
                    No
                  </button>
                  <div className="w-px bg-neutral-200" />
                  <button type="button" aria-pressed={hasTan} onClick={() => setHasTan(true)}
                    className={cn("px-4 py-1.5 transition-colors",
                      hasTan ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50")}>
                    Yes
                  </button>
                </div>
              </div>

              {hasTan && (
                <div className="max-w-xs">
                  <FieldLabel htmlFor="hfin-tan">Enter TAN</FieldLabel>
                  <Input
                    id="hfin-tan"
                    value={tanNumber}
                    onChange={(e) => setTanNumber(e.target.value.toUpperCase())}
                    placeholder="Enter 10-digit TAN"
                    maxLength={10}
                    className="uppercase"
                  />
                </div>
              )}
            </div>
          </div>
        </Section>
      </form>
    </>
  );
}
