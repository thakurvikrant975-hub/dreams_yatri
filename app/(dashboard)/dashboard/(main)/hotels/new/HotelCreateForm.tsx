"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {Select, SelectContent, SelectItem,SelectTrigger, SelectValue,} from "../../components/ui/select";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../components/location/location.types";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { createHotel } from "../actions";
import { CATEGORIES, STAY_TYPES } from "../constants";
import { toast } from "sonner";
import { Hotel, Search, Loader2, ClipboardPaste } from "lucide-react";
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "@/app/lib/assets/country-codes";
import { cn } from "@/app/lib/utils";

type Destination = {
  id: number;
  name: string;
  region: { name: string };
};

// ── Inline phone field (country code + number + paste) ────────────────────

function PhoneField({
  cc, setCC, num, setNum, placeholder = "98765 43210",
}: {
  cc: string;
  setCC: (v: string) => void;
  num: string;
  setNum: (v: string) => void;
  placeholder?: string;
}) {
  async function handlePaste() {
    try {
      const text    = await navigator.clipboard.readText();
      let cleaned   = text.replace(/[\s\-().]/g, "");
      const without = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
      const matched = [...COUNTRY_CODES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find(c => without.startsWith(c.dial.replace("+", "")));
      if (matched) {
        setCC(matched.code);
        cleaned = without.slice(matched.dial.replace("+", "").length);
      } else {
        cleaned = without;
      }
      setNum(cleaned);
      toast.success("Number pasted");
    } catch {
      toast.error("Could not read clipboard — paste manually");
    }
  }

  return (
    <div className="flex gap-1.5 items-center">
      <select
        value={cc}
        onChange={e => setCC(e.target.value)}
        className="h-9 w-22.5 shrink-0 rounded-md border border-input bg-background px-2 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
        ))}
      </select>
      <Input
        value={num}
        onChange={e => setNum(e.target.value.replace(/[^\d\s]/g, ""))}
        placeholder={placeholder}
        inputMode="numeric"
        className="flex-1 min-w-0"
      />
      <Button
        type="button" variant="outline" size="icon"
        className="shrink-0 h-9 w-9"
        onClick={handlePaste}
        title="Paste number from clipboard"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function HotelCreateForm({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [stayType, setStayType] = useState("");
  const [checkIn, setCheckIn] = useState("14:00");
  const [checkOut, setCheckOut] = useState("11:00");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [pincode, setPincode] = useState("");
  const [businessPhoneCC, setBusinessPhoneCC] = useState(DEFAULT_COUNTRY.code);
  const [businessPhoneNum, setBusinessPhoneNum] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [whatsappCC, setWhatsappCC] = useState(DEFAULT_COUNTRY.code);
  const [whatsappNum, setWhatsappNum] = useState("");
  const [b2bEmail, setB2bEmail] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [thumbnail, setThumbnail] = useState<PickedImage[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaTitleManual, setMetaTitleManual] = useState(false);
  const [metaDescManual, setMetaDescManual] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Keep SEO fields in sync with name/description until user manually edits them
  useEffect(() => {
    if (!metaTitleManual) setMetaTitle(name ? `${name} | Dreams Yatri`.slice(0, 60) : "");
  }, [name, metaTitleManual]);
  useEffect(() => {
    if (!metaDescManual) setMetaDesc(description ? description.slice(0, 160) : "");
  }, [description, metaDescManual]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    setName(val);
    setSlug(
      val.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !slug || !destinationId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (thumbnail.length > 0 && thumbnail[0].status !== "uploaded") {
      toast.error("Please wait for thumbnail to finish uploading");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("destination_id", destinationId ? String(destinationId) : "");
      formData.append("thumbnail", thumbnail[0]?.key ?? "");
      formData.append("category", CATEGORIES.find(c => c.id === categoryId)?.value ?? "");
      formData.append("stay_type", stayType);
      formData.append("check_in_time", checkIn);
      formData.append("check_out_time", checkOut);
      formData.append("address", address);
      formData.append("city", city);
      formData.append("state", state);
      formData.append("country", country);
      formData.append("pincode", pincode);
      const bpDial = COUNTRY_CODES.find(c => c.code === businessPhoneCC)?.dial ?? "+91";
      const waDial = COUNTRY_CODES.find(c => c.code === whatsappCC)?.dial ?? "+91";
      formData.append("business_phone", businessPhoneNum ? `${bpDial} ${businessPhoneNum}`.trim() : "");
      formData.append("business_email", businessEmail);
      formData.append("whatsapp_number", whatsappNum ? `${waDial} ${whatsappNum}`.trim() : "");
      formData.append("b2b_email", b2bEmail);
      formData.append("location_id", location?.id ?? "");
      formData.append("description", description);
      formData.append("is_active", String(isActive));
      formData.append("meta_title", metaTitle);
      formData.append("meta_desc", metaDesc);

      const result = await createHotel({ success: false, message: "" }, formData);

      if (result.success && result.id) {
        setFieldErrors({});
        toast.success(result.message);
        router.push(`/dashboard/hotels/${result.id}`);
      } else {
        const errs: Record<string, string> = {};
        if (result.errors) {
          for (const [key, msgs] of Object.entries(result.errors)) {
            if (msgs?.[0]) errs[key] = msgs[0];
          }
        }
        setFieldErrors(errs);
        const errorCount = Object.keys(errs).length;
        toast.error(
          errorCount > 0
            ? `${result.message} — ${errorCount} field${errorCount !== 1 ? "s" : ""} need attention`
            : result.message,
        );
        if (errorCount > 0) {
          const firstKey = Object.keys(errs)[0];
          setTimeout(() => {
            document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Basic Info ────────────────────────────────────────────── */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hotel className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Basic Information</CardTitle>
          </div>
          <CardDescription>Hotel name, location and category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div id="field-name" className="space-y-1.5">
              <Label>Hotel Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Grand Houseboat Srinagar"
                value={name}
                onChange={handleNameChange}
                autoComplete="off"
                className={cn(fieldErrors.name && "border-destructive focus-visible:ring-destructive")}
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>
            <div id="field-slug" className="space-y-1.5">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input
                placeholder="grand-houseboat-srinagar"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className={cn(fieldErrors.slug && "border-destructive focus-visible:ring-destructive")}
              />
              {fieldErrors.slug && <p className="text-xs text-destructive">{fieldErrors.slug}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div id="field-destination_id" className="space-y-1.5">
              <Label>Destination <span className="text-destructive">*</span></Label>
              <SearchSelect
                value={destinationId}
                onChange={(val) => setDestinationId(val)}
                fetchOptions={async (q) => {
                  const lower = q.toLowerCase();
                  return destinations
                    .filter(d =>
                      d.name.toLowerCase().includes(lower) ||
                      d.region.name.toLowerCase().includes(lower)
                    )
                    .map(d => ({ id: d.id, label: d.name, description: d.region.name }));
                }}
                placeholder="Search destination…"
              />
              {fieldErrors.destination_id && <p className="text-xs text-destructive">{fieldErrors.destination_id}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <SearchSelect
                value={categoryId}
                onChange={(id) => setCategoryId(id)}
                fetchOptions={async (q) => {
                  const lower = q.toLowerCase();
                  return CATEGORIES
                    .filter(c => c.label.toLowerCase().includes(lower))
                    .map(c => ({ id: c.id, label: c.label }));
                }}
                placeholder="Search category…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Stay Type</Label>
              <Select value={stayType} onValueChange={setStayType}>
                <SelectTrigger><SelectValue placeholder="Select stay type" /></SelectTrigger>
                <SelectContent>
                  {STAY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Check-in Time</Label>
              <Input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Check-out Time</Label>
              <Input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationSearchSelect
              value={location}
              onChange={(loc) => {
                setLocation(loc);
                if (loc) {
                  setAddress(loc.breadcrumb);
                  setCity(loc.city_name ?? "");
                  setState(loc.state_name ?? "");
                  setCountry(loc.country_name ?? "");
                }
              }}
              placeholder="Search hotel location…"
              types={["HOTEL"]}
              lockedType="HOTEL"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Address <span className="text-xs text-muted-foreground">(editable)</span></Label>
            <Input
              placeholder="Boulevard Road, Dal Lake, Srinagar, J&K"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Srinagar" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input placeholder="Jammu & Kashmir" value={state} onChange={e => setState(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input placeholder="India" value={country} onChange={e => setCountry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input placeholder="190001" value={pincode} onChange={e => setPincode(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div id="field-business_phone" className="space-y-1.5">
              <Label>Business Phone</Label>
              <div className={cn(fieldErrors.business_phone && "rounded-md ring-1 ring-destructive")}>
                <PhoneField
                  cc={businessPhoneCC} setCC={setBusinessPhoneCC}
                  num={businessPhoneNum} setNum={setBusinessPhoneNum}
                />
              </div>
              {fieldErrors.business_phone && <p className="text-xs text-destructive">{fieldErrors.business_phone}</p>}
            </div>
            <div id="field-business_email" className="space-y-1.5">
              <Label>Business Email</Label>
              <Input
                type="email"
                placeholder="hotel@example.com"
                value={businessEmail}
                onChange={e => setBusinessEmail(e.target.value)}
                className={cn(fieldErrors.business_email && "border-destructive focus-visible:ring-destructive")}
              />
              {fieldErrors.business_email && <p className="text-xs text-destructive">{fieldErrors.business_email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div id="field-whatsapp_number" className="space-y-1.5">
              <Label>WhatsApp Number</Label>
              <div className={cn(fieldErrors.whatsapp_number && "rounded-md ring-1 ring-destructive")}>
                <PhoneField
                  cc={whatsappCC} setCC={setWhatsappCC}
                  num={whatsappNum} setNum={setWhatsappNum}
                />
              </div>
              {fieldErrors.whatsapp_number && <p className="text-xs text-destructive">{fieldErrors.whatsapp_number}</p>}
            </div>
            <div id="field-b2b_email" className="space-y-1.5">
              <Label>B2B / Reservations Email</Label>
              <Input
                type="email"
                placeholder="reservations@hotel.com"
                value={b2bEmail}
                onChange={e => setB2bEmail(e.target.value)}
                className={cn(fieldErrors.b2b_email && "border-destructive focus-visible:ring-destructive")}
              />
              {fieldErrors.b2b_email
                ? <p className="text-xs text-destructive">{fieldErrors.b2b_email}</p>
                : <p className="text-xs text-muted-foreground">Used for booking vouchers &amp; amendments</p>
              }
            </div>
          </div>


          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="A brief description of the hotel..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-1.5">
            <Label>Thumbnail</Label>
            <p className="text-xs text-muted-foreground">
              Used in package cards and listing pages · 400×250 recommended
            </p>
            <ImagePicker
              folder="hotels"
              value={thumbnail}
              onChange={setThumbnail}
              maxFiles={1}
              label="Upload Thumbnail"
              hint="Small card image · JPG, PNG, WebP"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible on Dreams Yatri</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {/* ── SEO ──────────────────────────────────────────────────── */}
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">SEO</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!metaTitle) setMetaTitle(`${name} | Dreams Yatri`.slice(0, 60));
                if (!metaDesc) setMetaDesc(description.slice(0, 160));
              }}
            >
              Autofill from title &amp; description
            </Button>
          </div>
          <CardDescription>Optional — improves Google search visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div id="field-meta_title" className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Meta Title</Label>
              <span className={`text-xs ${metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaTitle.length}/60
              </span>
            </div>
            <Input
              placeholder="Grand Houseboat Srinagar | Dreams Yatri Hotels"
              value={metaTitle}
              onChange={e => { setMetaTitle(e.target.value); setMetaTitleManual(true); }}
              className={cn(fieldErrors.meta_title && "border-destructive focus-visible:ring-destructive")}
            />
            {fieldErrors.meta_title && <p className="text-xs text-destructive">{fieldErrors.meta_title}</p>}
          </div>
          <div id="field-meta_desc" className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Meta Description</Label>
              <span className={`text-xs ${metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaDesc.length}/160
              </span>
            </div>
            <Textarea
              placeholder="Stay in a traditional Kashmiri houseboat on Dal Lake..."
              value={metaDesc}
              onChange={e => { setMetaDesc(e.target.value); setMetaDescManual(true); }}
              rows={3}
              className={cn(fieldErrors.meta_desc && "border-destructive focus-visible:ring-destructive")}
            />
            {fieldErrors.meta_desc && <p className="text-xs text-destructive">{fieldErrors.meta_desc}</p>}
          </div>
        </CardContent>
      </Card>

      {/* ── Notice ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-dashed bg-dashboard-base-100 px-4 py-3 text-sm text-dashboard-base-content/75">
        Rooms and pricing can be added after the hotel is created, from the hotel's edit page.
      </div>

      {/* ── Submit ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button type="button" variant="outline" className="bg-dashboard-error text-dashboard-base-100 hover:bg-dashboard-error hover:text-dashboard-base-100" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-[140px] bg-dashboard-primary py-2.5">
          {isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
            : "Create Hotel"
          }
        </Button>
      </div>
    </form>
  );
}
