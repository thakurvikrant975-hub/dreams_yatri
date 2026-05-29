"use client";

import { useActionState, useRef, useState } from "react";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Button }   from "../../../components/ui/button";
import { Switch }   from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { Loader2 } from "lucide-react";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { LocationSearchSelect } from "../../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../../components/location/location.types";
import { SearchSelect } from "../../../components/dashboard/SearchSelect";
import { updateHotelDetails } from "../../actions";
import { CATEGORIES, STAY_TYPES } from "../../constants";

type Hotel = {
  id:             number;
  name:           string;
  slug:           string;
  thumbnail:      string | null;
  category:       string | null;
  stay_type:      string | null;
  check_in_time:  string | null;
  check_out_time: string | null;
  address:        string | null;
  city:           string | null;
  state:          string | null;
  country:        string | null;
  pincode:        string | null;
  business_phone: string | null;
  business_email: string | null;
  description:    string | null;
  meta_title:     string | null;
  meta_desc:      string | null;
  is_active:      boolean;
  location:       LocationValue | null;
  destination:    { id: number; name: string };
};

type Destination = { id: number; name: string; region: { name: string } };

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

export function DetailsTab({
  hotel,
  destinations,
}: {
  hotel:        Hotel;
  destinations: Destination[];
}) {
  const boundAction = updateHotelDetails.bind(null, hotel.id);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    { success: false, message: "" }
  );

  const [location, setLocation] = useState<LocationValue | null>(hotel.location);
  const [address,   setAddress]   = useState(hotel.address ?? "");
  const [metaTitle, setMetaTitle] = useState(hotel.meta_title ?? "");
  const [metaDesc,  setMetaDesc]  = useState(hotel.meta_desc  ?? "");
  const [destinationId, setDestinationId] = useState<number | null>(hotel.destination.id);

  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  function handleAutofillSEO() {
    const name = nameRef.current?.value ?? hotel.name;
    const desc = descRef.current?.value ?? hotel.description ?? "";
    if (!metaTitle) setMetaTitle(`${name} | Dreams Yatri`.slice(0, 60));
    if (!metaDesc)  setMetaDesc(desc.slice(0, 160));
  }

  // Thumbnail state — managed separately so we can preview and pass key via hidden input
  const [thumbnail, setThumbnail] = useState<PickedImage[]>(
    hotel.thumbnail
      ? [{
          id:         "existing-thumb",
          key:        hotel.thumbnail,
          url:        `${base}/${hotel.thumbnail}`,
          name:       "thumbnail",
          size:       0,
          status:     "uploaded" as const,
          is_primary: true,
        }]
      : []
  );

  return (
    <form action={formAction} className="space-y-6">

      {/* Status message */}
      {state.message && (
        <div className={`text-sm px-3 py-2 rounded-xl border ${
          state.success
            ? "bg-dashboard-success/10 text-dashboard-success border-dashboard-success/30"
            : "bg-dashboard-error/10 text-dashboard-error border-dashboard-error/20"
        }`}>
          {state.message}
        </div>
      )}

      {/* ── Basic Info ──────────────────────────────────────────── */}
      <Card className="bg-dashboard-base-100 rounded-xl shadow-lg border border-dashboard-base-content/20">
        <CardHeader>
          <CardTitle className="text-base text-dashboard-base-content">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Hotel Name</Label>
              <Input ref={nameRef} name="name" defaultValue={hotel.name} required
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Slug</Label>
              <Input
                name="slug" defaultValue={hotel.slug} readOnly
                className="bg-dashboard-base-200 border-dashboard-base-content/20 text-dashboard-base-content/50 cursor-not-allowed"
              />
              <p className="text-xs text-dashboard-base-content/40">Cannot change after creation</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Destination <span className="text-dashboard-error">*</span></Label>
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
                initialLabel={hotel.destination.name}
              />
              <input type="hidden" name="destination_id" value={destinationId ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Category</Label>
              <Select name="category" defaultValue={hotel.category ?? ""}>
                <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="cursor-pointer">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Stay Type</Label>
              <Select name="stay_type" defaultValue={hotel.stay_type ?? ""}>
                <SelectTrigger className="bg-dashboard-base-100 border-dashboard-base-content/20 cursor-pointer"><SelectValue placeholder="Select stay type" /></SelectTrigger>
                <SelectContent>
                  {STAY_TYPES.map(t => <SelectItem key={t} value={t} className="cursor-pointer">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Check-in Time</Label>
              <Input type="time" name="check_in_time" defaultValue={hotel.check_in_time ?? "14:00"}
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Check-out Time</Label>
              <Input type="time" name="check_out_time" defaultValue={hotel.check_out_time ?? "11:00"}
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-dashboard-base-content">Location</Label>
            <LocationSearchSelect
              value={location}
              onChange={(loc) => { setLocation(loc); if (loc) setAddress(loc.breadcrumb); }}
              placeholder="Search hotel location…"
              types={["HOTEL"]}
              lockedType="HOTEL"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Business Phone</Label>
              <Input name="business_phone" type="tel" defaultValue={hotel.business_phone ?? ""} placeholder="+91 9876543210"
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Business Email</Label>
              <Input name="business_email" type="email" defaultValue={hotel.business_email ?? ""} placeholder="hotel@example.com"
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
          </div>

          <input type="hidden" name="location_id" value={location?.id ?? ""} />

          <div className="space-y-1.5">
            <Label className="text-sm text-dashboard-base-content">Description</Label>
            <Textarea ref={descRef} name="description" defaultValue={hotel.description ?? ""} rows={4}
              className="bg-dashboard-base-100 border-dashboard-base-content/20" />
          </div>

          {/* ── Thumbnail ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-sm text-dashboard-base-content">Thumbnail</Label>
            <p className="text-xs text-dashboard-base-content/50">
              Used in package cards and listings · Different from gallery photos
            </p>
            <ImagePicker
              folder="hotels" value={thumbnail} onChange={setThumbnail}
              maxFiles={1} label="Upload Thumbnail" hint="400×250 recommended · JPG, PNG, WebP"
            />
            <input type="hidden" name="thumbnail" value={thumbnail[0]?.key ?? ""} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dashboard-base-content/20 p-4 bg-dashboard-base-200/40">
            <div>
              <p className="text-sm font-medium text-dashboard-base-content">Active</p>
              <p className="text-xs text-dashboard-base-content/50">Visible on Dreams Yatri</p>
            </div>
            <Switch name="is_active" value="true" defaultChecked={hotel.is_active} />
          </div>
        </CardContent>
      </Card>

      {/* ── SEO ───────────────────────────────────────────────────── */}
      <Card className="bg-dashboard-base-100 rounded-xl shadow-lg border border-dashboard-base-content/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-dashboard-base-content">SEO</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={handleAutofillSEO}
              className="border-dashboard-base-content/20 text-dashboard-base-content/70 hover:bg-dashboard-base-200 cursor-pointer">
              Autofill from title &amp; description
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-dashboard-base-content">Meta Title</Label>
              <span className={`text-xs ${metaTitle.length > 60 ? "text-dashboard-error" : "text-dashboard-base-content/50"}`}>
                {metaTitle.length}/60
              </span>
            </div>
            <Input name="meta_title" value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
              className="bg-dashboard-base-100 border-dashboard-base-content/20" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-dashboard-base-content">Meta Description</Label>
              <span className={`text-xs ${metaDesc.length > 160 ? "text-dashboard-error" : "text-dashboard-base-content/50"}`}>
                {metaDesc.length}/160
              </span>
            </div>
            <Textarea name="meta_desc" value={metaDesc} onChange={e => setMetaDesc(e.target.value)} rows={3}
              className="bg-dashboard-base-100 border-dashboard-base-content/20" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}
          className="min-w-30 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 cursor-pointer">
          {isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}