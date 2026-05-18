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
import { Loader2 } from "lucide-react";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { LocationPickerField } from "../../../components/dashboard/LocationPickerField";
import type { LocationResult } from "../../../components/dashboard/LocationSearchInput";
import { SearchSelect } from "../../../components/dashboard/SearchSelect";
import { updateHotelDetails } from "../../actions";

const CATEGORIES = [
  { value: "hotel",     label: "Hotel" },
  { value: "resort",    label: "Resort" },
  { value: "houseboat", label: "Houseboat" },
  { value: "villa",     label: "Villa" },
  { value: "homestay",  label: "Homestay" },
];

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
  description:    string | null;
  meta_title:     string | null;
  meta_desc:      string | null;
  is_active:      boolean;
  latitude:       number | null;
  longitude:      number | null;
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

  const [location, setLocation] = useState<LocationResult | null>(
    hotel.latitude != null && hotel.longitude != null
      ? {
          place_name: hotel.address ?? `${hotel.latitude}, ${hotel.longitude}`,
          place_id: "",
          address: hotel.address ?? `${hotel.latitude}, ${hotel.longitude}`,
          latitude: Number(hotel.latitude),
          longitude: Number(hotel.longitude),
        }
      : null,
  );
  const [address, setAddress] = useState(hotel.address ?? "");
  const [destinationId, setDestinationId] = useState<number | null>(hotel.destination.id);

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
        <div className={`text-sm px-3 py-2 rounded-md ${
          state.success
            ? "bg-green-500/10 text-green-700 border border-green-200"
            : "bg-destructive/10 text-destructive"
        }`}>
          {state.message}
        </div>
      )}

      {/* ── Basic Info ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Hotel Name</Label>
              <Input name="name" defaultValue={hotel.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                name="slug"
                defaultValue={hotel.slug}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Cannot change after creation</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
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
                initialLabel={hotel.destination.name}
              />
              <input type="hidden" name="destination_id" value={destinationId ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select name="category" defaultValue={hotel.category ?? ""}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stay Type</Label>
              <Select name="stay_type" defaultValue={hotel.stay_type ?? ""}>
                <SelectTrigger><SelectValue placeholder="Select stay type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Deluxe">Deluxe</SelectItem>
                  <SelectItem value="Super Deluxe">Super Deluxe</SelectItem>
                  <SelectItem value="Luxury">Luxury</SelectItem>
                  <SelectItem value="Super Luxury">Super Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Check-in Time</Label>
              <Input type="time" name="check_in_time" defaultValue={hotel.check_in_time ?? "14:00"} />
            </div>
            <div className="space-y-1.5">
              <Label>Check-out Time</Label>
              <Input type="time" name="check_out_time" defaultValue={hotel.check_out_time ?? "11:00"} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <LocationPickerField
              value={location}
              onChange={(v) => {
                setLocation(v);
                if (v) setAddress(v.address);
              }}
              placeholder="Search hotel address or pin on map…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Address <span className="text-xs text-muted-foreground">(editable)</span></Label>
            <Input
              name="address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Dal Lake, Srinagar..."
            />
          </div>

          <input type="hidden" name="latitude"  value={location?.latitude  ?? ""} />
          <input type="hidden" name="longitude" value={location?.longitude ?? ""} />

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={hotel.description ?? ""} rows={4} />
          </div>

          {/* ── Thumbnail ─────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label>Thumbnail</Label>
            <p className="text-xs text-muted-foreground">
              Used in package cards and listings · Different from gallery photos
            </p>
            <ImagePicker
              folder="hotels"
              value={thumbnail}
              onChange={setThumbnail}
              maxFiles={1}
              label="Upload Thumbnail"
              hint="400×250 recommended · JPG, PNG, WebP"
            />
            {/* Hidden input — passes key to server action */}
            <input type="hidden" name="thumbnail" value={thumbnail[0]?.key ?? ""} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible on Dreams Yatri</p>
            </div>
            <Switch name="is_active" value="true" defaultChecked={hotel.is_active} />
          </div>
        </CardContent>
      </Card>

      {/* ── SEO ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Meta Title</Label>
            <Input name="meta_title" defaultValue={hotel.meta_title ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Meta Description</Label>
            <Textarea name="meta_desc" defaultValue={hotel.meta_desc ?? ""} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="min-w-[120px]">
          {isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            : "Save Changes"
          }
        </Button>
      </div>
    </form>
  );
}