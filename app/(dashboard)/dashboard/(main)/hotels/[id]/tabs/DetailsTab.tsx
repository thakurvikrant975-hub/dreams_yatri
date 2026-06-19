"use client";

import { useActionState, useState } from "react";
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
import { Loader2, MessageCircle } from "lucide-react";

import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { LocationSearchSelect } from "../../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../../components/location/location.types";
import { SearchSelect } from "../../../components/dashboard/SearchSelect";
import { PhoneInput } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/PhoneInput";
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
  business_phone:            string | null;
  business_email:            string | null;
  whatsapp_number: string | null;
  b2b_email:       string | null;
  description:               string | null;
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

  const [location,  setLocation]  = useState<LocationValue | null>(hotel.location);
  const [address,   setAddress]   = useState(hotel.address ?? "");
  const [city,      setCity]      = useState(hotel.city ?? "");
  const [province,  setProvince]  = useState(hotel.state ?? "");
  const [country,   setCountry]   = useState(hotel.country ?? "");
  const [pincode,   setPincode]   = useState(hotel.pincode ?? "");
  const [destinationId, setDestinationId] = useState<number | null>(hotel.destination.id);
  const [categoryId, setCategoryId] = useState<number | null>(
    CATEGORIES.find(c => c.value === hotel.category)?.id ?? null
  );
  const [description, setDescription] = useState(hotel.description ?? "");
  const [hotelName,   setHotelName]   = useState(hotel.name);

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
              <Input
                name="name"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))}
                required
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
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
                initialLabel={CATEGORIES.find(c => c.value === hotel.category)?.label ?? ""}
              />
              <input
                type="hidden"
                name="category"
                value={CATEGORIES.find(c => c.id === categoryId)?.value ?? ""}
              />
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
              onChange={(loc) => {
                setLocation(loc);
                if (loc) {
                  setAddress(loc.breadcrumb);
                  setCity(loc.city_name ?? "");
                  setProvince(loc.state_name ?? "");
                  setCountry(loc.country_name ?? "");
                }
              }}
              placeholder="Search hotel location…"
              types={["HOTEL"]}
              lockedType="HOTEL"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">City</Label>
              <Input
                name="city"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Srinagar"
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">State</Label>
              <Input
                name="state"
                value={province}
                onChange={e => setProvince(e.target.value)}
                placeholder="Jammu & Kashmir"
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Country</Label>
              <Input
                name="country"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="India"
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Pincode</Label>
              <Input
                name="pincode"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                placeholder="190001"
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Business Phone</Label>
              <PhoneInput name="business_phone" defaultValue={hotel.business_phone ?? ""} placeholder="98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">Business Email</Label>
              <Input name="business_email" type="email" defaultValue={hotel.business_email ?? ""} placeholder="hotel@example.com"
                className="bg-dashboard-base-100 border-dashboard-base-content/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">WhatsApp Number</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <PhoneInput name="whatsapp_number" defaultValue={hotel.whatsapp_number ?? ""} placeholder="98765 43210" />
                </div>
                {hotel.whatsapp_number && (
                  <a
                    href={`https://wa.me/${hotel.whatsapp_number.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 shrink-0 rounded-md px-3 py-2 text-xs font-medium bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Open Chat
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-dashboard-base-content">B2B / Reservations Email</Label>
              <Input
                name="b2b_email"
                type="email"
                defaultValue={hotel.b2b_email ?? ""}
                placeholder="reservations@hotel.com"
                className="bg-dashboard-base-100 border-dashboard-base-content/20"
              />
              <p className="text-xs text-dashboard-base-content/40">Used for booking vouchers &amp; amendments</p>
            </div>
          </div>

          <input type="hidden" name="location_id" value={location?.id ?? ""} />

          <div className="space-y-1.5">
            <Label className="text-sm text-dashboard-base-content">Description</Label>
            <Textarea
              name="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Write a brief description of this hotel…"
              rows={4}
              className="bg-dashboard-base-100 border-dashboard-base-content/20"
            />
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