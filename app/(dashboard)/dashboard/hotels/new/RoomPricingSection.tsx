"use client";

import { useState }  from "react";
import { Input }     from "../../components/ui/input";
import { Label }     from "../../components/ui/label";
import { Button }    from "../../components/ui/button";
import { Badge }     from "../../components/ui/badge";
import { Switch }    from "../../components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../components/ui/table";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/app/lib/utils";


// ── Types ─────────────────────────────────────────────────────────────────

export type RoomRow = {
  id?:               number;   // undefined for new rows not yet saved
  room_type:         string;
  description:       string;
  occupancy:         number;
  price_per_night:   number;
  original_price?:   number;
  season:            string;
  margin_percentage: number;
  is_active:         boolean;
  amenities:         string[];
};

const SEASONS = [
  { value: "all",    label: "All Season" },
  { value: "peak",   label: "Peak Season" },
  { value: "summer", label: "Summer" },
  { value: "winter", label: "Winter" },
];

const AMENITIES_LIST = [
  "AC", "WiFi", "TV", "Hot Water", "Heater", "Balcony",
  "Lake View", "Mountain View", "Breakfast", "Room Service",
];

const EMPTY_ROOM: RoomRow = {
  room_type:         "",
  description:       "",
  occupancy:         2,
  price_per_night:   0,
  original_price:    undefined,
  season:            "all",
  margin_percentage: 10,
  is_active:         true,
  amenities:         [],
};

// ── Inline Room Form ──────────────────────────────────────────────────────

export function RoomForm({
  initial,
  onSave,
  onCancel,
}: {
  initial:  RoomRow;
  onSave:   (row: RoomRow) => void;
  onCancel: () => void;
}) {
  const [room, setRoom] = useState<RoomRow>(initial);

  function update(key: keyof RoomRow, value: unknown) {
    setRoom(prev => ({ ...prev, [key]: value }));
  }

  function toggleAmenity(a: string) {
    setRoom(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a],
    }));
  }

  function handleSave() {
    if (!room.room_type) return;
    if (!room.price_per_night || room.price_per_night <= 0) return;
    onSave(room);
  }

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Room Type <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Deluxe Double Room"
            value={room.room_type}
            onChange={e => update("room_type", e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Season</Label>
          <Select value={room.season} onValueChange={v => update("season", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEASONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label>Price/Night (₹) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            placeholder="3500"
            value={room.price_per_night || ""}
            onChange={e => update("price_per_night", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Original Price (₹)</Label>
          <Input
            type="number"
            placeholder="4500"
            value={room.original_price || ""}
            onChange={e => update("original_price", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Occupancy</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={room.occupancy}
            onChange={e => update("occupancy", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Margin %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={room.margin_percentage}
            onChange={e => update("margin_percentage", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          placeholder="Spacious room with Dal Lake view..."
          value={room.description}
          onChange={e => update("description", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Amenities</Label>
        <div className="flex flex-wrap gap-2">
          {AMENITIES_LIST.map(a => {
            const selected = room.amenities.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  selected
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={room.is_active}
            onCheckedChange={v => update("is_active", v)}
          />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!room.room_type || !room.price_per_night}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> Save Room
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────

export function RoomPricingSection({
  rooms,
  onChange,
}: {
  rooms:    RoomRow[];
  onChange: (rooms: RoomRow[]) => void;
}) {
  const [adding,    setAdding]    = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function handleAdd(room: RoomRow) {
    onChange([...rooms, room]);
    setAdding(false);
  }

  function handleEdit(index: number, room: RoomRow) {
    const updated = [...rooms];
    updated[index] = room;
    onChange(updated);
    setEditIndex(null);
  }

  function handleDelete(index: number) {
    onChange(rooms.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {/* Room table */}
      {rooms.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Room Type</TableHead>
                <TableHead>Season</TableHead>
                <TableHead className="text-right">Price/Night</TableHead>
                <TableHead className="text-center">Occupancy</TableHead>
                <TableHead>Amenities</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room, index) => (
                editIndex === index ? (
                  <TableRow key={index}>
                    <TableCell colSpan={7} className="p-0">
                      <div className="p-3">
                        <RoomForm
                          initial={room}
                          onSave={r => handleEdit(index, r)}
                          onCancel={() => setEditIndex(null)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={index} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{room.room_type}</p>
                        {room.description && (
                          <p className="text-xs text-muted-foreground">{room.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {room.season}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-semibold text-sm">₹{room.price_per_night.toLocaleString()}</p>
                        {room.original_price && (
                          <p className="text-xs text-muted-foreground line-through">
                            ₹{room.original_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">{room.occupancy} guests</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 3).map(a => (
                          <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {a}
                          </Badge>
                        ))}
                        {room.amenities.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{room.amenities.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={cn(
                        "h-2 w-2 rounded-full mx-auto",
                        room.is_active ? "bg-green-500" : "bg-muted-foreground"
                      )} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditIndex(index)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add room form */}
      {adding ? (
        <RoomForm
          initial={EMPTY_ROOM}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed py-2 h-10"
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Room Type
        </Button>
      )}

      {rooms.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No rooms added yet — click above to add your first room type
        </p>
      )}
    </div>
  );
}