"use client";

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import { Input }                   from "../../components/ui/input";
import { Label }                   from "../../components/ui/label";
import { Textarea }                from "../../components/ui/textarea";
import { Button }                  from "../../components/ui/button";
import { Switch }                  from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { ImagePicker, type PickedImage } from "../../components/dashboard/ImagePicker";
import { LocationPickerField } from "../../components/dashboard/LocationPickerField";
import type { LocationResult } from "../../components/dashboard/LocationSearchInput";
import { createHotel } from "../actions";
import { toast }    from "sonner";
import { Hotel, Search, Loader2 } from "lucide-react";

type Destination = {
  id:     number;
  name:   string;
  region: { name: string };
};

const CATEGORIES = [
  { value: "hotel",     label: "Hotel" },
  { value: "resort",    label: "Resort" },
  { value: "houseboat", label: "Houseboat" },
  { value: "villa",     label: "Villa" },
  { value: "homestay",  label: "Homestay" },
];

export function HotelCreateForm({ destinations }: { destinations: Destination[] }) {
  const router                       = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name,          setName]          = useState("");
  const [slug,          setSlug]          = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [category,      setCategory]      = useState("");
  const [stayType,      setStayType]      = useState("");
  const [starRating,    setStarRating]    = useState("");
  const [checkIn,       setCheckIn]       = useState("14:00");
  const [checkOut,      setCheckOut]      = useState("11:00");
  const [address,       setAddress]       = useState("");
  const [location,      setLocation]      = useState<LocationResult | null>(null);
  const [description,   setDescription]   = useState("");
  const [isActive,      setIsActive]      = useState(true);
  const [thumbnail,     setThumbnail]     = useState<PickedImage[]>([]);
  const [metaTitle,     setMetaTitle]     = useState("");
  const [metaDesc,      setMetaDesc]      = useState("");

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
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
      formData.append("name",           name);
      formData.append("slug",           slug);
      formData.append("destination_id", destinationId);
      formData.append("thumbnail",      thumbnail[0]?.key ?? "");
      formData.append("category",       category);
      formData.append("stay_type",      stayType);
      formData.append("star_rating",    starRating);
      formData.append("check_in_time",  checkIn);
      formData.append("check_out_time", checkOut);
      formData.append("address",        address);
      formData.append("latitude",       location?.latitude  != null ? String(location.latitude)  : "");
      formData.append("longitude",      location?.longitude != null ? String(location.longitude) : "");
      formData.append("description",    description);
      formData.append("is_active",      String(isActive));
      formData.append("meta_title",     metaTitle);
      formData.append("meta_desc",      metaDesc);

      const result = await createHotel({ success: false, message: "" }, formData);

      if (result.success) {
        toast.success(result.message);
        router.push("/dashboard/hotels");
      } else {
        toast.error(result.message);
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
            <div className="space-y-1.5">
              <Label>Hotel Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Grand Houseboat Srinagar"
                value={name}
                onChange={handleNameChange}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input
                placeholder="grand-houseboat-srinagar"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Destination <span className="text-destructive">*</span></Label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {destinations.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                      <span className="text-muted-foreground ml-1 text-xs">({d.region.name})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
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
              <Select value={stayType} onValueChange={setStayType}>
                <SelectTrigger><SelectValue placeholder="Select stay type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Deluxe 2*">Deluxe 2*</SelectItem>
                  <SelectItem value="Super Deluxe 3*">Super Deluxe 3*</SelectItem>
                  <SelectItem value="Luxury 4*">Luxury 4*</SelectItem>
                  <SelectItem value="Super Luxury 5*">Super Luxury 5*</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Star Rating</Label>
              <Select value={starRating} onValueChange={setStarRating}>
                <SelectTrigger><SelectValue placeholder="Stars" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(s => (
                    <SelectItem key={s} value={String(s)}>{"★".repeat(s)} {s} Star</SelectItem>
                  ))}
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
              placeholder="Boulevard Road, Dal Lake, Srinagar, J&K"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
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
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">SEO</CardTitle>
          </div>
          <CardDescription>Optional — improves Google search visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Meta Title</Label>
              <span className={`text-xs ${metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaTitle.length}/60
              </span>
            </div>
            <Input
              placeholder="Grand Houseboat Srinagar | Dreams Yatri Hotels"
              value={metaTitle}
              onChange={e => setMetaTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Meta Description</Label>
              <span className={`text-xs ${metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaDesc.length}/160
              </span>
            </div>
            <Textarea
              placeholder="Stay in a traditional Kashmiri houseboat on Dal Lake..."
              value={metaDesc}
              onChange={e => setMetaDesc(e.target.value)}
              rows={3}
            />
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
