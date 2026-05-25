"use client";

import { useState, useEffect, useTransition } from "react";
import {
  User, Car, FileText, Banknote, Plus, Pencil,
  Phone, CreditCard, Shield, Info,
} from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Switch }   from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import { cn }   from "@/app/lib/utils";

import {
  MultiStepSheet,
  useMultiStepSheet,
  type SheetStep,
} from "../../components/dashboard/MultiStepSheet";
import {
  ImagePicker,
  type PickedImage,
} from "../../components/dashboard/ImagePicker";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue }   from "../../components/location/location.types";

import {
  createCabDriver, updateCabDriver, getCabPricingRateForDriver,
  type CabDriverFull, type CabDriverVehicle,
} from "./actions";

// ── Constants ─────────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: "+91",  label: "+91 India" },
  { code: "+1",   label: "+1 USA/Canada" },
  { code: "+44",  label: "+44 UK" },
  { code: "+61",  label: "+61 Australia" },
  { code: "+971", label: "+971 UAE" },
  { code: "+966", label: "+966 Saudi Arabia" },
  { code: "+65",  label: "+65 Singapore" },
  { code: "+60",  label: "+60 Malaysia" },
  { code: "+49",  label: "+49 Germany" },
  { code: "+33",  label: "+33 France" },
  { code: "+81",  label: "+81 Japan" },
  { code: "+86",  label: "+86 China" },
  { code: "+7",   label: "+7 Russia" },
  { code: "+55",  label: "+55 Brazil" },
  { code: "+27",  label: "+27 South Africa" },
  { code: "+977", label: "+977 Nepal" },
  { code: "+94",  label: "+94 Sri Lanka" },
  { code: "+880", label: "+880 Bangladesh" },
];


// ── Native date input styled to match dashboard Input ─────────────────────────

function DateInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full min-w-0 rounded-lg px-3 py-2 text-xs outline-none transition-colors",
        "bg-dashboard-base-100 border border-dashboard-base-content/85",
        "text-dashboard-base-content placeholder:text-dashboard-base-content/35",
        "focus-visible:border-dashboard-primary focus-visible:ring-1 focus-visible:ring-dashboard-primary/30",
        "scheme-light dark:scheme-dark",
        className,
      )}
    />
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

const DRIVER_STEPS: SheetStep[] = [
  {
    id:          "identity",
    title:       "Identity",
    description: "Profile photo, name, and contact",
    icon:        <User className="h-4 w-4" />,
    validate: (data) => {
      if (!data.name || !(data.name as string).trim()) return "Driver name is required";
      if (!data.mobile || !(data.mobile as string).trim()) return "Mobile number is required";
      const countryCode = (data.mobile_country_code as string) ?? "+91";
      const digits = (data.mobile as string).replace(/\D/g, "");
      if (countryCode === "+91" && digits.length !== 10) return "Enter a valid 10-digit mobile number";
      if (countryCode !== "+91" && digits.length < 5) return "Enter a valid mobile number";
      if (!data.cityValue) return "City is required";
      if (!data.stateValue) return "State is required";
      return null;
    },
  },
  {
    id:          "vehicle",
    title:       "Vehicle",
    description: "Assign a vehicle to this driver",
    icon:        <Car className="h-4 w-4" />,
    validate: (data) => {
      if (!data.vehicle_id || data.vehicle_id === "none") return "Please assign a vehicle to this driver";
      return null;
    },
  },
  {
    id:          "documents",
    title:       "Documents",
    description: "Licence, registration, insurance & vehicle photos",
    icon:        <FileText className="h-4 w-4" />,
    validate: (data) => {
      if (!data.vehicle_reg_number || !(data.vehicle_reg_number as string).trim())
        return "Vehicle registration number is required";
      if (!((data.vehicleImages as PickedImage[])?.length))
        return "At least one vehicle photo is required";
      return null;
    },
  },
  {
    id:          "payment",
    title:       "Payment",
    description: "Trip rate and bank details for payments",
    icon:        <Banknote className="h-4 w-4" />,
    optional:    true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function toPickedImage(key: string | null | undefined): PickedImage[] {
  if (!key) return [];
  return [{
    id: `existing-${key}`, key,
    url: `${R2}/${key}`,
    name: key, size: 0, status: "uploaded", is_primary: true,
  }];
}

function toPickedImages(keys: string[]): PickedImage[] {
  return keys.map((key) => ({
    id: `existing-${key}`, key,
    url: `${R2}/${key}`,
    name: key, size: 0, status: "uploaded",
  }));
}

function parseMobile(stored: string): { code: string; number: string } {
  if (!stored) return { code: "+91", number: "" };
  // Normalize: always work with a leading +
  const withPlus = stored.startsWith("+") ? stored : `+${stored}`;
  // Try country codes longest-first to avoid greedy partial matches (e.g. +91 vs +971)
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const { code } of sorted) {
    if (withPlus.startsWith(code)) {
      return { code, number: withPlus.slice(code.length).replace(/\D/g, "") };
    }
  }
  // Fallback: plain digits with no recognisable prefix → assume India
  return { code: "+91", number: stored.replace(/\D/g, "") };
}

// ── Step 1: Identity ──────────────────────────────────────────────────────────

function IdentityStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data = stepData["identity"] ?? {};

  const name              = (data.name              as string)        ?? "";
  const mobile            = (data.mobile            as string)        ?? "";
  const mobile2           = (data.mobile2           as string)        ?? "";
  const mobile_country_code  = (data.mobile_country_code  as string)  ?? "+91";
  const mobile2_country_code = (data.mobile2_country_code as string)  ?? "+91";
  const cityValue         = (data.cityValue         as LocationValue | null) ?? null;
  const stateValue        = (data.stateValue        as LocationValue | null) ?? null;
  const countryValue      = (data.countryValue      as LocationValue | null) ?? null;
  const is_active         = (data.is_active         as boolean)       ?? true;
  const profileImages     = (data.profileImages     as PickedImage[]) ?? [];

  function set(key: string, value: unknown) {
    setStepData("identity", { ...data, [key]: value });
  }

  return (
    <div className="space-y-4">
      {/* Profile Image */}
      <div className="space-y-1.5">
        <Label>
          Profile Photo{" "}
          <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </Label>
        <ImagePicker
          folder="cab-drivers"
          value={profileImages}
          onChange={(imgs) => set("profileImages", imgs)}
          maxFiles={1}
          label="Upload Profile Photo"
          hint="Square photo recommended · JPG, PNG, WebP"
        />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>Full Name <span className="text-destructive">*</span></Label>
        <Input
          placeholder="Ramesh Kumar"
          value={name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Primary Mobile */}
      <div className="space-y-1.5">
        <Label>Mobile <span className="text-destructive">*</span></Label>
        <div className="flex gap-2">
          <Select
            value={mobile_country_code}
            onValueChange={(v) => set("mobile_country_code", v)}
          >
            <SelectTrigger className="w-36 shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={mobile_country_code === "+91" ? "9876543210" : "Enter number"}
              value={mobile}
              onChange={(e) =>
                set("mobile", e.target.value.replace(/\D/g, "").slice(0, mobile_country_code === "+91" ? 10 : 15))
              }
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Secondary Mobile */}
      <div className="space-y-1.5">
        <Label>
          Secondary Mobile{" "}
          <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="flex gap-2">
          <Select
            value={mobile2_country_code}
            onValueChange={(v) => set("mobile2_country_code", v)}
          >
            <SelectTrigger className="w-36 shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={mobile2_country_code === "+91" ? "9876543210" : "Enter number"}
              value={mobile2}
              onChange={(e) =>
                set("mobile2", e.target.value.replace(/\D/g, "").slice(0, mobile2_country_code === "+91" ? 10 : 15))
              }
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label>City <span className="text-destructive">*</span></Label>
        <LocationSearchSelect
          value={cityValue}
          onChange={(v) => {
            const base: Record<string, unknown> = { ...data, cityValue: v };
            setStepData("identity", base);
            if (!v?.breadcrumb) return;
            // breadcrumb: "City, State, Country"
            const parts       = v.breadcrumb.split(",").map((p) => p.trim());
            const stateName   = parts[1] ?? "";
            const countryName = parts[2] ?? "";
            const search = (q: string, type: string) =>
              q
                ? fetch(`/api/locations/search?q=${encodeURIComponent(q)}&types=${type}&limit=1`)
                    .then((r) => (r.ok ? r.json() : []))
                    .catch(() => [] as LocationValue[])
                : Promise.resolve([] as LocationValue[]);
            // Fetch both in parallel, then set once to avoid overwrites
            Promise.all([search(stateName, "STATE"), search(countryName, "COUNTRY")]).then(
              ([stateRes, countryRes]) => {
                setStepData("identity", {
                  ...base,
                  ...(stateRes[0]   ? { stateValue:   stateRes[0]   } : {}),
                  ...(countryRes[0] ? { countryValue: countryRes[0] } : {}),
                });
              },
            );
          }}
          types={["CITY"]}
          placeholder="Search city…"
          disableExternalSearch
          hideRecent
        />
      </div>

      {/* State */}
      <div className="space-y-1.5">
        <Label>State <span className="text-destructive">*</span></Label>
        <LocationSearchSelect
          value={stateValue}
          onChange={(v) => set("stateValue", v)}
          types={["STATE"]}
          placeholder="Search state…"
          disableExternalSearch
          hideRecent
        />
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <Label>
          Country{" "}
          <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </Label>
        <LocationSearchSelect
          value={countryValue}
          onChange={(v) => set("countryValue", v)}
          types={["COUNTRY"]}
          placeholder="Search country…"
          hideRecent
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Driver is available for trip assignments
          </p>
        </div>
        <Switch checked={is_active} onCheckedChange={(v) => set("is_active", v)} />
      </div>
    </div>
  );
}

// ── Step 2: Vehicle Assignment ────────────────────────────────────────────────

function VehicleStep({ vehicles }: { vehicles: CabDriverVehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data       = stepData["vehicle"] ?? {};
  const vehicle_id = (data.vehicle_id as string) ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>
          Assigned Vehicle <span className="text-destructive">*</span>
        </Label>
        <Select
          value={vehicle_id}
          onValueChange={(v) => setStepData("vehicle", { ...data, vehicle_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a vehicle…" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.name}{" "}
                <span className="text-muted-foreground text-xs">
                  · {v.type.replace(/_/g, " ")}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The cab this driver primarily operates. You can reassign anytime.
        </p>
      </div>

      {/* Preview selected vehicle */}
      {vehicle_id && vehicle_id !== "none" && (() => {
        const v = vehicles.find((x) => String(x.id) === vehicle_id);
        if (!v) return null;
        return (
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.type.replace(/_/g, " ")}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Step 3: Documents & Compliance ───────────────────────────────────────────

function DocumentsStep() {
  const { stepData, setStepData } = useMultiStepSheet();
  const data = stepData["documents"] ?? {};

  const license_number     = (data.license_number     as string) ?? "";
  const license_expiry     = (data.license_expiry     as string) ?? "";
  const licenseImages      = (data.licenseImages      as PickedImage[]) ?? [];
  const vehicle_reg_number = (data.vehicle_reg_number as string) ?? "";
  const vehicle_reg_expiry = (data.vehicle_reg_expiry as string) ?? "";
  const insurance_expiry   = (data.insurance_expiry   as string) ?? "";
  const vehicleImages      = (data.vehicleImages      as PickedImage[]) ?? [];

  function set(key: string, value: unknown) {
    setStepData("documents", { ...data, [key]: value });
  }

  return (
    <div className="space-y-5">

      {/* Licence Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <CreditCard className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Driving Licence</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>
              Licence Number{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="RJ14 20200012345"
              value={license_number}
              onChange={(e) => set("license_number", e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Licence Expiry{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <DateInput
              value={license_expiry}
              onChange={(v) => set("license_expiry", v)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Licence Photo{" "}
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <ImagePicker
            folder="cab-drivers"
            value={licenseImages}
            onChange={(imgs) => set("licenseImages", imgs)}
            maxFiles={2}
            label="Upload Licence Image"
            hint="Front & back · JPG, PNG, WebP"
          />
        </div>
      </div>

      {/* Vehicle Registration Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Car className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Vehicle Registration</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Registration Number <span className="text-destructive">*</span></Label>
            <Input
              placeholder="RJ 14 CA 1234"
              value={vehicle_reg_number}
              onChange={(e) => set("vehicle_reg_number", e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Registration Expiry{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <DateInput
              value={vehicle_reg_expiry}
              onChange={(v) => set("vehicle_reg_expiry", v)}
            />
          </div>
        </div>
      </div>

      {/* Insurance Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Shield className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Insurance</p>
        </div>

        <div className="space-y-1.5">
          <Label>
            Insurance Expiry{" "}
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <DateInput
            value={insurance_expiry}
            onChange={(v) => set("insurance_expiry", v)}
          />
        </div>
      </div>

      {/* Vehicle Photos */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Car className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">
            Vehicle Photos <span className="text-destructive">*</span>
          </p>
        </div>
        <ImagePicker
          folder="cab-drivers"
          value={vehicleImages}
          onChange={(imgs) => set("vehicleImages", imgs)}
          maxFiles={6}
          label="Upload Vehicle Photos"
          hint="Up to 6 photos · JPG, PNG, WebP · At least 1 required"
        />
      </div>
    </div>
  );
}

// ── Step 4: Payment Details ───────────────────────────────────────────────────

function PaymentStep({ vehicles }: { vehicles: CabDriverVehicle[] }) {
  const { stepData, setStepData } = useMultiStepSheet();
  const data = stepData["payment"] ?? {};

  const per_trip_rate        = (data.per_trip_rate        as string) ?? "";
  const bank_name            = (data.bank_name            as string) ?? "";
  const bank_account_holder  = (data.bank_account_holder  as string) ?? "";
  const bank_account_number  = (data.bank_account_number  as string) ?? "";
  const bank_ifsc            = (data.bank_ifsc            as string) ?? "";
  const upi_id               = (data.upi_id              as string)  ?? "";

  // Cross-step reads for placeholder
  const cityValue  = (stepData["identity"]?.cityValue  as LocationValue | undefined);
  const vehicleId  = (stepData["vehicle"]?.vehicle_id  as string | undefined);
  const vehicle    = vehicles.find((v) => String(v.id) === vehicleId);

  const [pricingRate, setPricingRate] = useState<{ price: number; pricing_type: string } | null>(null);

  useEffect(() => {
    const destId = cityValue?.id ? Number(cityValue.id) : 0;
    const vId    = vehicleId && vehicleId !== "none" ? Number(vehicleId) : 0;
    if (!destId || !vId) { setPricingRate(null); return; }
    getCabPricingRateForDriver(destId, vId).then(setPricingRate);
  }, [cityValue?.id, vehicleId]);

  const rateUnit = pricingRate?.pricing_type === "PER_KM" ? "/km" : "/day";
  const ratePlaceholder = pricingRate && vehicle && cityValue
    ? `e.g. ₹${pricingRate.price}${rateUnit} — ${cityValue.name} · ${vehicle.name}`
    : vehicle && cityValue
    ? `Rate for ${cityValue.name} · ${vehicle.name} not found`
    : "Enter agreed rate";

  function set(key: string, value: unknown) {
    setStepData("payment", { ...data, [key]: value });
  }

  return (
    <div className="space-y-5">

      {/* Trip Rate */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Banknote className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Per Trip Rate</p>
        </div>

        <div className="space-y-1.5">
          <Label>
            Agreed Rate per Trip (₹){" "}
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
              ₹
            </span>
            <Input
              type="number"
              placeholder={ratePlaceholder}
              value={per_trip_rate}
              onChange={(e) => set("per_trip_rate", e.target.value)}
              className="pl-7"
            />
          </div>
          {pricingRate && vehicle && cityValue && (
            <p className="text-xs text-muted-foreground">
              Cab pricing: ₹{pricingRate.price}{rateUnit} for {vehicle.name} in {cityValue.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Base rate agreed with this driver for each trip.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2.5">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Advance payment is released at trip assignment. Final payment (remaining balance) is
            released after the trip is completed and reviewed.
          </p>
        </div>
      </div>

      {/* Bank Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b">
          <CreditCard className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Bank Details</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input
              placeholder="State Bank of India"
              value={bank_name}
              onChange={(e) => set("bank_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Account Holder Name</Label>
            <Input
              placeholder="Ramesh Kumar"
              value={bank_account_holder}
              onChange={(e) => set("bank_account_holder", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input
                placeholder="123456789012"
                value={bank_account_number}
                onChange={(e) => set("bank_account_number", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC Code</Label>
              <Input
                placeholder="SBIN0001234"
                value={bank_ifsc}
                onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              UPI ID{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="ramesh@upi"
              value={upi_id}
              onChange={(e) => set("upi_id", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Build initial data from existing driver ───────────────────────────────────

function buildInitialData(d: CabDriverFull): Record<string, Record<string, unknown>> {
  const { code: mobileCode, number: mobileNumber }   = parseMobile(d.mobile ?? "");
  const { code: mobile2Code, number: mobile2Number } = parseMobile(d.mobile_secondary ?? "");

  const fakeLocation = (name: string, type: LocationValue["type"]): LocationValue => ({
    id: "0", name, type, breadcrumb: name, slug: "",
  });

  return {
    identity: {
      name:                 d.name,
      mobile:               mobileNumber,
      mobile_country_code:  mobileCode,
      mobile2:              mobile2Number,
      mobile2_country_code: mobile2Code,
      cityValue:            d.city  ? fakeLocation(d.city,  "CITY")  : null,
      stateValue:           d.state ? fakeLocation(d.state, "STATE") : null,
      countryValue:         null,
      is_active:            d.is_active,
      profileImages:        toPickedImage(d.profile_image_key),
    },
    vehicle: {
      vehicle_id: d.vehicle_id ? String(d.vehicle_id) : "",
    },
    documents: {
      license_number:     d.license_number     ?? "",
      license_expiry:     d.license_expiry     ? d.license_expiry.split("T")[0] : "",
      licenseImages:      toPickedImage(d.license_image_key),
      vehicle_reg_number: d.vehicle_reg_number ?? "",
      vehicle_reg_expiry: d.vehicle_reg_expiry ? d.vehicle_reg_expiry.split("T")[0] : "",
      insurance_expiry:   d.insurance_expiry   ? d.insurance_expiry.split("T")[0] : "",
      vehicleImages:      toPickedImages(d.vehicle_image_keys),
    },
    payment: {
      per_trip_rate:       d.salary_amount != null ? String(d.salary_amount) : "",
      bank_name:           d.bank_name           ?? "",
      bank_account_holder: d.bank_account_holder ?? "",
      bank_account_number: d.bank_account_number ?? "",
      bank_ifsc:           d.bank_ifsc           ?? "",
      upi_id:              d.upi_id              ?? "",
    },
  };
}

function buildCreateInitialData(): Record<string, Record<string, unknown>> {
  return { identity: { is_active: true, mobile_country_code: "+91", mobile2_country_code: "+91" } };
}

// ── Collect input helper ──────────────────────────────────────────────────────

function collectInput(data: Record<string, unknown>) {
  const cityValue    = data.cityValue as LocationValue | undefined;
  const countryCode  = (data.mobile_country_code  as string) ?? "+91";
  const countryCode2 = (data.mobile2_country_code as string) ?? "+91";
  const mobileRaw    = (data.mobile  as string)?.trim() ?? "";
  const mobile2Raw   = (data.mobile2 as string)?.trim() ?? "";
  const vehicleId    = (data.vehicle_id as string);
  const perTripRate  = (data.per_trip_rate as string);

  return {
    name:                (data.name    as string)?.trim() ?? "",
    mobile:              mobileRaw ? `${countryCode}${mobileRaw}` : "",
    mobile_secondary:    mobile2Raw ? `${countryCode2}${mobile2Raw}` : null,
    profile_image_key:   ((data.profileImages as PickedImage[])?.[0]?.key) ?? null,
    city:                cityValue?.name?.trim() || null,
    state:               ((data.stateValue as LocationValue)?.name)?.trim() || null,
    vehicle_id:          vehicleId && vehicleId !== "none" ? Number(vehicleId) : null,
    license_number:      (data.license_number     as string)?.trim() || null,
    license_expiry:      (data.license_expiry     as string) || null,
    license_image_key:   ((data.licenseImages    as PickedImage[])?.[0]?.key) ?? null,
    vehicle_reg_number:  (data.vehicle_reg_number as string)?.trim() || null,
    vehicle_reg_expiry:  (data.vehicle_reg_expiry as string) || null,
    insurance_expiry:    (data.insurance_expiry   as string) || null,
    vehicle_image_keys:  ((data.vehicleImages     as PickedImage[]) ?? []).map((i) => i.key).filter(Boolean) as string[],
    bank_name:           (data.bank_name           as string)?.trim() || null,
    bank_account_holder: (data.bank_account_holder as string)?.trim() || null,
    bank_account_number: (data.bank_account_number as string)?.trim() || null,
    bank_ifsc:           (data.bank_ifsc           as string)?.trim() || null,
    upi_id:              (data.upi_id              as string)?.trim() || null,
    salary_type:         perTripRate ? "PER_TRIP" : null,
    salary_amount:       perTripRate ? Number(perTripRate) : null,
  };
}

// ── Create Sheet ──────────────────────────────────────────────────────────────

export function CreateDriverSheet({ vehicles }: { vehicles: CabDriverVehicle[] }) {
  const [open,      setOpen]    = useState(false);
  const [sheetKey,  setSheetKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const input = { ...collectInput(data), is_active: (data.is_active as boolean) ?? true };
      const result = await createCabDriver(input);
      if (result.success) {
        toast.success(result.message);
        setSheetKey((k) => k + 1);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Driver
      </Button>

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Add Cab Driver"
        description="Register a new driver"
        steps={DRIVER_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Add Driver"
        initialStepData={buildCreateInitialData()}
      >
        <IdentityStep />
        <VehicleStep vehicles={vehicles} />
        <DocumentsStep />
        <PaymentStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}

// ── Edit Sheet ────────────────────────────────────────────────────────────────

export function EditDriverSheet({
  driver,
  vehicles,
  trigger,
}: {
  driver:   CabDriverFull;
  vehicles: CabDriverVehicle[];
  trigger?: React.ReactNode;
}) {
  const [open,      setOpen]    = useState(false);
  const [sheetKey,  setSheetKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  async function handleComplete(data: Record<string, unknown>) {
    startTransition(async () => {
      const input = { ...collectInput(data), is_active: (data.is_active as boolean) ?? driver.is_active };
      const result = await updateCabDriver(driver.id, input);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  const handleOpen = () => { setSheetKey((k) => k + 1); setOpen(true); };

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen} className="cursor-pointer">{trigger}</span>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      <MultiStepSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        title="Edit Driver"
        description={`Editing: ${driver.name}`}
        steps={DRIVER_STEPS}
        onComplete={handleComplete}
        isSubmitting={isPending}
        submitLabel="Save Changes"
        initialStepData={buildInitialData(driver)}
      >
        <IdentityStep />
        <VehicleStep vehicles={vehicles} />
        <DocumentsStep />
        <PaymentStep vehicles={vehicles} />
      </MultiStepSheet>
    </>
  );
}
