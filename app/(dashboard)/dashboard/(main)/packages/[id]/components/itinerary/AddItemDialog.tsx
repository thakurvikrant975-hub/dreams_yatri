"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Badge } from "../../../../components/ui/badge";
import { toast } from "sonner";
import {
  addStayAction,
  addActivityAction,
  addTransferAction,
  addNoteAction,
} from "@/app/actions/packages/itinerary.actions";
import type {
  PendingDrop,
  TimelineItemKind,
  RoomOption,
  ActivityOption,
} from "./timeline.types";

// ── Cab types from schema enum ─────────────────────────────────────────────────

const CAB_TYPES = [
  "SEDAN",
  "HATCHBACK",
  "SUV",
  "INNOVA",
  "ERTIGA",
  "WAGON_R",
  "BOLERO",
  "TEMPO_TRAVELLER",
  "MINI_VAN",
  "BUS",
] as const;

type CabTypeValue = (typeof CAB_TYPES)[number];

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  pending: PendingDrop | null;
  dayId: number;
  roomOptions: RoomOption[];
  activityOptions: ActivityOption[];
  categories: Array<{ id: number; slug: string; label: string }>;
  onSuccess: (kind: TimelineItemKind, newId: number) => Promise<void>;
  onClose: () => void;
};

// ── Stay form ──────────────────────────────────────────────────────────────────

function StayForm({
  dayId,
  roomOptions,
  categories,
  insertIndex,
  onSuccess,
  onClose,
}: {
  dayId: number;
  roomOptions: RoomOption[];
  categories: Props["categories"];
  insertIndex: number;
  onSuccess: Props["onSuccess"];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(
    categories[0]?.id ? String(categories[0].id) : ""
  );
  const [roomId, setRoomId] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredRooms = categoryId
    ? roomOptions
    : roomOptions;

  function handleSubmit() {
    if (!roomId || !categoryId) return toast.error("Select a hotel room");
    startTransition(async () => {
      const res = await addStayAction({
        itinerary_id: dayId,
        stay_category_id: parseInt(categoryId),
        room_pricing_id: parseInt(roomId),
        sort_order: insertIndex,
      });
      if (!res.success) return toast.error(res.error);
      await onSuccess("stay", res.data.id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Stay Category</Label>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setRoomId(""); }}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Hotel / Room</Label>
        {filteredRooms.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No hotels available
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {filteredRooms.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRoomId(String(opt.id))}
                className={`w-full rounded-md border px-3 py-2.5 text-left text-xs transition-colors ${
                  roomId === String(opt.id)
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/30"
                }`}
              >
                <p className="font-semibold truncate">{opt.hotel.name}</p>
                {opt.room && (
                  <p className="text-muted-foreground">{opt.room.name}</p>
                )}
                <p className="text-muted-foreground mt-0.5">
                  ₹{Number(opt.price_per_night).toLocaleString()} / night
                  {" · "}
                  {opt.hotel.destination.name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={isPending || !roomId || !categoryId}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Plus className="mr-1 h-4 w-4" />
          Add Stay
        </Button>
      </div>
    </div>
  );
}

// ── Activity form ──────────────────────────────────────────────────────────────

function ActivityForm({
  dayId,
  activityOptions,
  insertIndex,
  onSuccess,
  onClose,
}: {
  dayId: number;
  activityOptions: ActivityOption[];
  insertIndex: number;
  onSuccess: Props["onSuccess"];
  onClose: () => void;
}) {
  const [activityId, setActivityId] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAdd(optional: boolean) {
    if (!activityId) return toast.error("Select an activity");
    startTransition(async () => {
      const res = await addActivityAction({
        itinerary_id: dayId,
        activity_id: parseInt(activityId),
        sort_order: insertIndex,
        is_optional: optional,
      });
      if (!res.success) return toast.error(res.error);
      await onSuccess("activity", res.data.id);
    });
  }

  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {activityOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No activities for this destination
          </p>
        ) : (
          activityOptions.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => setActivityId(String(act.id))}
              className={`w-full rounded-md border px-3 py-2.5 text-left text-xs transition-colors ${
                activityId === String(act.id)
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{act.name}</p>
                {act.category && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {act.category}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5">
                ₹{Number(act.price).toLocaleString()}
                {act.duration_hours && ` · ${act.duration_hours}h`}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => handleAdd(true)}
          disabled={isPending || !activityId}
        >
          {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Optional
        </Button>
        <Button
          className="flex-1"
          onClick={() => handleAdd(false)}
          disabled={isPending || !activityId}
        >
          {isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Transfer form ──────────────────────────────────────────────────────────────

function TransferForm({
  dayId,
  insertIndex,
  onSuccess,
  onClose,
}: {
  dayId: number;
  insertIndex: number;
  onSuccess: Props["onSuccess"];
  onClose: () => void;
}) {
  const [cabType, setCabType] = useState<CabTypeValue | "">("");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [duration, setDuration] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const res = await addTransferAction({
        itinerary_id: dayId,
        cab_type: cabType || undefined,
        pickup_point: pickup || undefined,
        drop_point: drop || undefined,
        duration_text: duration || undefined,
        sort_order: insertIndex,
      });
      if (!res.success) return toast.error(res.error);
      await onSuccess("transfer", res.data.id);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Cab Type</Label>
        <Select value={cabType} onValueChange={(v) => setCabType(v as CabTypeValue | "")}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any</SelectItem>
            {CAB_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Pickup Point</Label>
          <Input
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="Airport, Hotel..."
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Drop Point</Label>
          <Input
            value={drop}
            onChange={(e) => setDrop(e.target.value)}
            placeholder="Hotel, Station..."
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Duration</Label>
        <Input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="~2 hrs, 45 min..."
          className="h-8 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Plus className="mr-1 h-4 w-4" />
          Add Transfer
        </Button>
      </div>
    </div>
  );
}

// ── Note form ──────────────────────────────────────────────────────────────────

function NoteForm({
  dayId,
  insertIndex,
  onSuccess,
  onClose,
}: {
  dayId: number;
  insertIndex: number;
  onSuccess: Props["onSuccess"];
  onClose: () => void;
}) {
  const [noteType, setNoteType] = useState("info");
  const [position, setPosition] = useState("bottom");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!message.trim()) return toast.error("Note message is required");
    startTransition(async () => {
      const res = await addNoteAction({
        itinerary_id: dayId,
        message: message.trim(),
        type: noteType as "info" | "warning" | "tip" | "important",
        position: position as "top" | "bottom",
        sort_order: insertIndex,
      });
      if (!res.success) return toast.error(res.error);
      await onSuccess("note", res.data.id);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["info", "warning", "tip", "important"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top of day</SelectItem>
              <SelectItem value="bottom">Bottom of day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Note for the customer..."
          rows={3}
          className="resize-none text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={isPending || !message.trim()}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Plus className="mr-1 h-4 w-4" />
          Add Note
        </Button>
      </div>
    </div>
  );
}

// ── Title map ──────────────────────────────────────────────────────────────────

const DIALOG_TITLES: Record<TimelineItemKind, string> = {
  stay: "Add Stay",
  activity: "Add Activity",
  transfer: "Add Transfer",
  note: "Add Note",
};

// ── Dialog wrapper ─────────────────────────────────────────────────────────────

export function AddItemDialog({
  open,
  pending,
  dayId,
  roomOptions,
  activityOptions,
  categories,
  onSuccess,
  onClose,
}: Props) {
  if (!pending) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{DIALOG_TITLES[pending.kind]}</DialogTitle>
        </DialogHeader>

        {pending.kind === "stay" && (
          <StayForm
            dayId={dayId}
            roomOptions={roomOptions}
            categories={categories}
            insertIndex={pending.insertIndex}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        )}
        {pending.kind === "activity" && (
          <ActivityForm
            dayId={dayId}
            activityOptions={activityOptions}
            insertIndex={pending.insertIndex}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        )}
        {pending.kind === "transfer" && (
          <TransferForm
            dayId={dayId}
            insertIndex={pending.insertIndex}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        )}
        {pending.kind === "note" && (
          <NoteForm
            dayId={dayId}
            insertIndex={pending.insertIndex}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
