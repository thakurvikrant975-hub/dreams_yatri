"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, AlertTriangle, Car, Hotel,
  UserCheck, MessageSquare, RefreshCw,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  confirmHotel, flagHotelIssue,
  confirmCab, flagCabIssue,
  confirmBooking, rejectBooking,
  assignMember, addNote,
} from "./actions";
import type { BookingWithRelations } from "./actions";

// ── Confirm Hotel ─────────────────────────────────────────────────────────────
export function HotelActionPanel({ booking }: { booking: BookingWithRelations }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  if (booking.hotelConfirmedAt) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">Hotel Confirmed</p>
        {booking.hotelNotes && (
          <p className="text-xs text-green-700 ml-1 truncate">— {booking.hotelNotes}</p>
        )}
      </div>
    );
  }

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmHotel(booking.id, notes || undefined);
      if (r.success) {
        toast.success("Hotel confirmed — booking moved to cab verification");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleFlag = () => {
    if (!notes.trim()) { toast.error("Please describe the issue"); return; }
    start(async () => {
      const r = await flagHotelIssue(booking.id, notes);
      if (r.success) {
        toast.success("Issue flagged");
        setFlagOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
        <Hotel className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800 font-medium flex-1">Hotel verification pending</p>
        <Button size="sm" variant="outline" onClick={() => setFlagOpen(true)} disabled={isPending}
          className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flag Issue
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending}
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Hotel
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Hotel Availability</DialogTitle>
            <DialogDescription>
              Confirm hotel is available for {booking.travellers} guest(s) on the travel dates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Hotel name, room type, rate confirmed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Flag Hotel Issue</DialogTitle>
            <DialogDescription>Describe the issue with hotel availability or pricing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Issue Description *</Label>
            <Textarea
              placeholder="Hotel fully booked, price mismatch, date conflict..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button onClick={handleFlag} disabled={isPending} variant="destructive">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Flag Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Confirm Cab ───────────────────────────────────────────────────────────────

export function CabActionPanel({ booking }: { booking: BookingWithRelations }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  if (booking.cabConfirmedAt) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">Cab Confirmed</p>
        {booking.cabNotes && (
          <p className="text-xs text-green-700 ml-1 truncate">— {booking.cabNotes}</p>
        )}
      </div>
    );
  }

//   if (!booking.hotelConfirmedAt) {
//     return (
//       <div className="flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2.5">
//         <Car className="h-4 w-4 text-muted-foreground shrink-0" />
//         <p className="text-sm text-muted-foreground">Cab verification — waiting for hotel confirmation</p>
//       </div>
//     );
//   }

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmCab(booking.id, notes || undefined);
      if (r.success) {
        toast.success("Cab confirmed — booking moved to ops review");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleFlag = () => {
    if (!notes.trim()) { toast.error("Please describe the issue"); return; }
    start(async () => {
      const r = await flagCabIssue(booking.id, notes);
      if (r.success) {
        toast.success("Issue flagged");
        setFlagOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2.5">
        <Car className="h-4 w-4 text-purple-600 shrink-0" />
        <p className="text-sm text-purple-800 font-medium flex-1">Cab verification pending</p>
        <Button size="sm" variant="outline" onClick={() => setFlagOpen(true)} disabled={isPending}
          className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flag Issue
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending}
          className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Cab
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Cab Availability</DialogTitle>
            <DialogDescription>Confirm cab/transport is arranged for this booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Vehicle type, driver contact, pickup point..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Flag Cab Issue</DialogTitle>
            <DialogDescription>Describe the transport issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Issue Description *</Label>
            <Textarea
              placeholder="No cab available on this date, route issue..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button onClick={handleFlag} disabled={isPending} variant="destructive">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Flag Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Ops Final Actions ─────────────────────────────────────────────────────────

export function OpsActionPanel({ booking }: { booking: BookingWithRelations }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  if (booking.status === "CONFIRMED") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">Booking Confirmed — Customer notified</p>
      </div>
    );
  }

  if (booking.status === "REJECTED") {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
        <p className="text-sm text-red-800 font-medium">Booking Rejected</p>
        {booking.rejectionReason && (
          <p className="text-xs text-red-700 mt-0.5">{booking.rejectionReason}</p>
        )}
      </div>
    );
  }

  const canConfirm = booking.hotelConfirmedAt && booking.cabConfirmedAt;

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmBooking(booking.id, note || undefined);
      if (r.success) {
        toast.success("Booking confirmed — confirmation email sent");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleReject = () => {
    if (!reason.trim()) { toast.error("Rejection reason is required"); return; }
    start(async () => {
      const r = await rejectBooking(booking.id, reason);
      if (r.success) {
        toast.success("Booking rejected — customer notified");
        setRejectOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
        <p className="text-sm text-orange-800 font-medium flex-1">
          {canConfirm ? "Ready for final confirmation" : "Awaiting department verifications"}
        </p>
        <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={isPending}
          className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50">
          <XCircle className="h-3 w-3 mr-1" /> Reject
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending || !canConfirm}
          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Booking
        </Button>
      </div>
      {!canConfirm && (
        <p className="text-xs text-muted-foreground px-1">
          Both hotel and cab must be verified before final confirmation.
        </p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              This will confirm the booking and send a confirmation email to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Message to customer (optional)</Label>
            <Textarea
              placeholder="Any special instructions or notes for the customer..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm & Notify Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              The customer will be notified with the rejection reason and refund will be initiated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Rejection Reason *</Label>
            <Textarea
              placeholder="Dates unavailable, package discontinued, customer request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={handleReject} disabled={isPending} variant="destructive">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Reject & Notify Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Assign Member ─────────────────────────────────────────────────────────────

export function AssignMemberPanel({
  booking,
  members,
}: {
  booking: BookingWithRelations;
  members: { id: string; name: string; department: { id: string; name: string } | null }[];
}) {
  const [selected, setSelected] = useState(booking.currentAssigneeId ?? "");
  const [isPending, start] = useTransition();
  const router = useRouter();

  const handleAssign = () => {
    if (!selected) return;
    start(async () => {
      const r = await assignMember(booking.id, selected);
      if (r.success) {
        toast.success("Member assigned");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="h-8 text-xs w-48">
          <SelectValue placeholder="Assign to..." />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}
              {m.department && (
                <span className="text-muted-foreground ml-1">· {m.department.name}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleAssign} disabled={isPending || !selected || selected === booking.currentAssigneeId}
        className="h-8 text-xs">
        {isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3 mr-1" />}
        Assign
      </Button>
    </div>
  );
}

// ── Add Note ──────────────────────────────────────────────────────────────────

export function AddNotePanel({ bookingId }: { bookingId: string }) {
  const [note, setNote] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  const handle = () => {
    if (!note.trim()) return;
    start(async () => {
      const r = await addNote(bookingId, note);
      if (r.success) {
        toast.success("Note added");
        setNote("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add an internal note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="text-sm resize-none"
      />
      <Button size="sm" onClick={handle} disabled={isPending || !note.trim()} className="h-8 text-xs">
        {isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
        Add Note
      </Button>
    </div>
  );
}