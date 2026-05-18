"use client";

import { useState, useTransition } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import {
  Plus, Pencil, Trash2, Star, Loader2, ChevronDown, ChevronUp, Images,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import {
  createRoom, updateRoom, deleteRoom,
  createRoomImages, deleteRoomImage, setPrimaryRoomImage,
} from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type RoomImage = {
  id: number;
  room_id: number;
  url: string;
  thumbnail: string | null;
  alt: string | null;
  is_primary: boolean;
  sort_order: number;
};

type DBRoom = {
  id: number;
  hotel_id: number;
  name: string;
  slug: string;
  area_sqft: number | null;
  bed_type: string | null;
  view_type: string | null;
  max_occupancy: number;
  amenities: unknown;
  features: unknown;
  bathroom: unknown;
  facilities: unknown;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  images: RoomImage[];
};

// ── Constants ─────────────────────────────────────────────────────────────

const BED_TYPES = ["Single", "Twin", "Double", "Queen", "King", "Suite", "Dormitory"];
const VIEW_TYPES = ["City View", "Mountain View", "Lake View", "Garden View", "Pool View", "Sea View", "No View"];
const AMENITY_OPTIONS = ["AC", "WiFi", "TV", "Hot Water", "Heater", "Balcony", "Geyser", "Safe", "Mini Bar", "Room Service"];
const FEATURE_OPTIONS = ["Work Desk", "Reading Chair", "Sofa", "Extra Bed Available", "Wardrobe", "Attached Bathroom"];

type RoomFormState = {
  name: string;
  slug: string;
  bed_type: string;
  view_type: string;
  area_sqft: string;
  max_occupancy: number;
  description: string;
  amenities: string[];
  features: string[];
  is_active: boolean;
  images: PickedImage[];
};

const EMPTY_FORM: RoomFormState = {
  name: "",
  slug: "",
  bed_type: "",
  view_type: "",
  area_sqft: "",
  max_occupancy: 3,
  description: "",
  amenities: [],
  features: [],
  is_active: true,
  images: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toFormState(room: DBRoom): RoomFormState {
  return {
    name: room.name,
    slug: room.slug,
    bed_type: room.bed_type ?? "",
    view_type: room.view_type ?? "",
    area_sqft: room.area_sqft ? String(room.area_sqft) : "",
    max_occupancy: room.max_occupancy,
    description: room.description ?? "",
    amenities: Array.isArray(room.amenities) ? (room.amenities as string[]) : [],
    features: Array.isArray(room.features) ? (room.features as string[]) : [],
    is_active: room.is_active,
    images: [],
  };
}

function buildFormData(form: RoomFormState): FormData {
  const fd = new FormData();
  fd.append("name", form.name);
  fd.append("slug", form.slug);
  fd.append("bed_type", form.bed_type);
  fd.append("view_type", form.view_type);
  fd.append("area_sqft", form.area_sqft);
  fd.append("max_occupancy", String(form.max_occupancy));
  fd.append("description", form.description);
  fd.append("amenities", JSON.stringify(form.amenities));
  fd.append("features", JSON.stringify(form.features));
  fd.append("is_active", String(form.is_active));
  return fd;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

// ── Tag Pill ──────────────────────────────────────────────────────────────

function TagPills({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              active
                ? "bg-primary/10 border-primary text-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Room Form ─────────────────────────────────────────────────────────────

function RoomForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  isNew = false,
}: {
  initial: RoomFormState;
  onSave: (form: RoomFormState) => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
}) {
  const [form, setForm] = useState<RoomFormState>(initial);

  function update<K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const capped = val.charAt(0).toUpperCase() + val.slice(1);
    update("name", capped);
    if (!initial.slug) update("slug", toSlug(capped));
  }

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Room Name <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Deluxe Queen Room"
            value={form.name}
            onChange={handleNameChange}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Slug <span className="text-destructive">*</span></Label>
          <Input
            placeholder="deluxe-queen-room"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Bed Type</Label>
          <Select value={form.bed_type} onValueChange={(v) => update("bed_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {BED_TYPES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>View Type</Label>
          <Select value={form.view_type} onValueChange={(v) => update("view_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {VIEW_TYPES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Area (sq ft)</Label>
          <Input
            type="number"
            placeholder="350"
            value={form.area_sqft}
            onChange={(e) => update("area_sqft", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max Occupancy</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={form.max_occupancy}
            onChange={(e) => update("max_occupancy", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          placeholder="Spacious room with panoramic views..."
          value={form.description}
          onChange={(e) => { const v = e.target.value; update("description", v.charAt(0).toUpperCase() + v.slice(1)); }}
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Amenities</Label>
        <TagPills
          options={AMENITY_OPTIONS}
          selected={form.amenities}
          onChange={(v) => update("amenities", v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Features</Label>
        <TagPills
          options={FEATURE_OPTIONS}
          selected={form.features}
          onChange={(v) => update("features", v)}
        />
      </div>

      {isNew && (
        <div className="space-y-1.5">
          <Label>Room Photos <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <ImagePicker
            folder="hotels"
            value={form.images}
            onChange={(imgs) => update("images", imgs)}
            maxFiles={8}
            label="Add Room Photos"
            hint="JPG, PNG, WebP"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => update("is_active", v)}
          />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!form.name || !form.slug || isSaving}
            onClick={() => onSave(form)}
          >
            {isSaving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : "Save Room"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Room Image Thumb ──────────────────────────────────────────────────────

function RoomImageThumb({
  image,
  room_id,
  hotel_id,
  onDelete,
  onSetPrimary,
}: {
  image: RoomImage;
  room_id: number;
  hotel_id: number;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-xl overflow-hidden border-2 bg-muted",
        image.is_primary ? "border-primary" : "border-border hover:border-muted-foreground/40"
      )}
    >
      <img
        src={`${base}/${image.url}`}
        alt={image.alt ?? "Room image"}
        className="w-full h-full object-cover"
      />
      {image.is_primary && (
        <Badge className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0 pointer-events-none bg-primary">
          <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
        </Badge>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
        {!image.is_primary && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-[10px] h-6 px-2"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await setPrimaryRoomImage(image.id, room_id, hotel_id);
                if (r.success) { toast.success(r.message); onSetPrimary(); }
                else toast.error(r.message);
              })
            }
          >
            <Star className="h-2.5 w-2.5 mr-1" /> Set Primary
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="destructive" className="text-[10px] h-6 px-2">
              <Trash2 className="h-2.5 w-2.5 mr-1" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the image from storage.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteRoomImage(
                      image.id, room_id, hotel_id, image.url, image.thumbnail ?? undefined
                    );
                    if (r.success) { toast.success(r.message); onDelete(); }
                    else toast.error(r.message);
                  })
                }
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Room Images Section ───────────────────────────────────────────────────

function RoomImagesSection({
  room,
  hotel_id,
}: {
  room: DBRoom;
  hotel_id: number;
}) {
  const [images, setImages] = useState<RoomImage[]>(room.images);
  const [picks, setPicks] = useState<PickedImage[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: number) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleSetPrimary(id: number) {
    setImages((prev) => prev.map((img) => ({ ...img, is_primary: img.id === id })));
  }

  function handleSave() {
    const uploaded = picks.filter((p) => p.status === "uploaded" && p.key);
    if (uploaded.length === 0) { toast.error("Wait for uploads to finish"); return; }

    startTransition(async () => {
      const result = await createRoomImages(
        room.id,
        hotel_id,
        uploaded.map((p) => ({ url: p.key!, thumbnail: p.key, alt: p.name }))
      );
      if (result.success) {
        toast.success(result.message);
        setPicks([]);
        const added: RoomImage[] = uploaded.map((p, i) => ({
          id: Date.now() + i,
          room_id: room.id,
          url: p.key!,
          thumbnail: p.key ?? null,
          alt: p.name,
          is_primary: images.length === 0 && i === 0,
          sort_order: images.length + i,
        }));
        setImages((prev) => [...prev, ...added]);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3 pt-4 border-t">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Images className="h-3.5 w-3.5" /> Room Photos ({images.length})
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {images
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((img) => (
              <RoomImageThumb
                key={img.id}
                image={img}
                room_id={room.id}
                hotel_id={hotel_id}
                onDelete={() => handleDelete(img.id)}
                onSetPrimary={() => handleSetPrimary(img.id)}
              />
            ))}
        </div>
      )}

      <ImagePicker
        folder="hotels"
        value={picks}
        onChange={setPicks}
        maxFiles={10}
        label="Add Room Photos"
        hint="JPG, PNG, WebP"
      />

      {picks.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending || picks.some((p) => p.status === "uploading")}
            className="gap-1.5"
          >
            {isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving...</>
              : <>Save {picks.filter((p) => p.status === "uploaded").length} Photo{picks.length !== 1 ? "s" : ""}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Room Row ──────────────────────────────────────────────────────────────

function RoomRow({
  room,
  hotel_id,
  onEdit,
  onDelete,
}: {
  room: DBRoom;
  hotel_id: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const amenities = Array.isArray(room.amenities) ? (room.amenities as string[]) : [];

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRoom(room.id, hotel_id);
      if (result.success) { toast.success(result.message); onDelete(); }
      else toast.error(result.message);
    });
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Room summary row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
        {/* Primary image preview */}
        <div className="h-12 w-16 rounded-lg bg-muted border shrink-0 overflow-hidden">
          {(() => {
            const primary = room.images.find((img) => img.is_primary) ?? room.images[0];
            return primary ? (
              <img
                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${primary.url}`}
                alt={room.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground/40 text-xs">
                No photo
              </div>
            );
          })()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{room.name}</p>
            {!room.is_active && (
              <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {room.bed_type && (
              <span className="text-xs text-muted-foreground">{room.bed_type}</span>
            )}
            {room.view_type && (
              <span className="text-xs text-muted-foreground">· {room.view_type}</span>
            )}
            {room.area_sqft && (
              <span className="text-xs text-muted-foreground">· {room.area_sqft} sq ft</span>
            )}
            <span className="text-xs text-muted-foreground">· {room.max_occupancy} guests</span>
            {amenities.slice(0, 3).map((a) => (
              <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">{a}</Badge>
            ))}
            {amenities.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{amenities.length - 3}</Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {room.images.length > 0 ? `${room.images.length} photos` : "Photos"}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Room</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete <span className="font-semibold">{room.name}</span>? This will also delete
                  all room images, pricing plans, and occupancy prices linked to this room.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Expandable images section */}
      {expanded && (
        <div className="px-4 pb-4 bg-muted/10">
          <RoomImagesSection room={room} hotel_id={hotel_id} />
        </div>
      )}
    </div>
  );
}

// ── Main RoomsTab ─────────────────────────────────────────────────────────

export function RoomsTab({
  hotel_id,
  rooms: initialRooms,
}: {
  hotel_id: number;
  rooms: DBRoom[];
}) {
  const [rooms, setRooms] = useState<DBRoom[]>(initialRooms);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(form: RoomFormState) {
    startTransition(async () => {
      const result = await createRoom(hotel_id, buildFormData(form));
      if (result.success) {
        const roomId = result.id!;
        const uploaded = form.images.filter((p) => p.status === "uploaded" && p.key);
        if (uploaded.length > 0) {
          await createRoomImages(
            roomId,
            hotel_id,
            uploaded.map((p) => ({ url: p.key!, thumbnail: p.key, alt: p.name }))
          );
        }
        toast.success(result.message);
        setAdding(false);
        setRooms((prev) => [
          ...prev,
          {
            id: roomId,
            hotel_id,
            name: form.name,
            slug: form.slug,
            bed_type: form.bed_type || null,
            view_type: form.view_type || null,
            area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
            max_occupancy: form.max_occupancy,
            description: form.description || null,
            amenities: form.amenities,
            features: form.features,
            bathroom: null,
            facilities: null,
            is_active: form.is_active,
            sort_order: prev.length,
            images: uploaded.map((p, i) => ({
              id: Date.now() + i,
              room_id: roomId,
              url: p.key!,
              thumbnail: p.key ?? null,
              alt: p.name,
              is_primary: i === 0,
              sort_order: i,
            })),
          },
        ]);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleEdit(id: number, form: RoomFormState) {
    startTransition(async () => {
      const result = await updateRoom(id, hotel_id, buildFormData(form));
      if (result.success) {
        toast.success(result.message);
        setEditId(null);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  name: form.name,
                  bed_type: form.bed_type || null,
                  view_type: form.view_type || null,
                  area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
                  max_occupancy: form.max_occupancy,
                  description: form.description || null,
                  amenities: form.amenities,
                  features: form.features,
                  is_active: form.is_active,
                }
              : r
          )
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: number) {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Rooms</CardTitle>
            <CardDescription>
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} · Manage room types, specs and photos
            </CardDescription>
          </div>
          {!adding && editId === null && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Room
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add form */}
        {adding && (
          <RoomForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            isSaving={isPending}
            isNew
          />
        )}

        {/* Room list */}
        {rooms.map((room) =>
          editId === room.id ? (
            <RoomForm
              key={room.id}
              initial={toFormState(room)}
              onSave={(form) => handleEdit(room.id, form)}
              onCancel={() => setEditId(null)}
              isSaving={isPending}
            />
          ) : (
            <RoomRow
              key={room.id}
              room={room}
              hotel_id={hotel_id}
              onEdit={() => setEditId(room.id)}
              onDelete={() => handleDelete(room.id)}
            />
          )
        )}

        {rooms.length === 0 && !adding && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No rooms added yet</p>
            <p className="text-xs mt-1">Click "Add Room" to define your first room type</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
