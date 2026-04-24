"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, RefreshCw, Hotel,
  Car, ChevronDown, MapPin, Star, Pencil,
  UserCheck, MessageSquare, XCircle,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "../../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { format } from "date-fns";
import {
  confirmBookingHotelDay, swapBookingHotel, flagHotelIssue,
  confirmBookingCabLeg, updateCabType, flagCabIssue,
  confirmBooking, rejectBooking, assignMember, addNote,
  getHotelsByCity,
} from "../actions";
import type { BookingWithRelations } from "../actions";

// ── Hotel Day Panel ───────────────────────────────────────────────────────────

export function HotelDayPanel({
  day, bookingId, destinationId, travellers,
}: {
  day: any;
  bookingId: string;
  destinationId: number;
  travellers: number;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapNote, setSwapNote] = useState("");
  const [nearbyHotels, setNearbyHotels] = useState<any[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedRoomType, setSelectedRoomType] = useState("");
  const [selectedRate, setSelectedRate] = useState(0);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [isPending, start] = useTransition();
  const router = useRouter();

  const mealsByType = (day.meals ?? []).reduce((acc: any, m: any) => {
    acc[m.mealType] = m;
    return acc;
  }, {});

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmBookingHotelDay(day.id, bookingId);
      if (r.success) {
        toast.success(`Day ${day.dayNumber} hotel confirmed`);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const loadNearbyHotels = async () => {
    setLoadingHotels(true);
    try {
      const hotels = await getHotelsByCity(day.cityName, destinationId);
      setNearbyHotels(hotels);
    } finally {
      setLoadingHotels(false);
    }
  };

  const handleSwap = () => {
    if (!selectedHotelId || !selectedRoomType || !selectedRate) {
      toast.error("Select hotel, room type and rate");
      return;
    }
    start(async () => {
      const r = await swapBookingHotel(
        day.id, bookingId, Number(selectedHotelId),
        selectedRoomType, selectedRate, swapNote || undefined
      );
      if (r.success) {
        toast.success("Hotel updated");
        setSwapOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const selectedHotelData = nearbyHotels.find((h) => String(h.id) === selectedHotelId);

  return (
    <>
      <div className={`rounded-lg border p-4 space-y-3 ${day.isConfirmed ? "bg-green-50/50 border-green-200" : "bg-card"}`}>
        {/* Day header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              D{day.dayNumber}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">{day.cityName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(day.checkInDate), "dd MMM")} → {format(new Date(day.checkOutDate), "dd MMM")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {day.isConfirmed ? (
              <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmed {day.confirmedAt ? format(new Date(day.confirmedAt), "dd MMM, h:mm a") : ""}
              </span>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => { setSwapOpen(true); loadNearbyHotels(); }}
                  disabled={isPending}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Change
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  {isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Confirm
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Hotel info */}
        <div className="flex items-start justify-between gap-4 bg-muted/30 rounded-md px-3 py-2.5 border">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{day.hotel?.name}</p>
            <div className="flex items-center gap-2">
              {day.hotel?.star_rating && (
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: day.hotel.star_rating }).map((_: any, i: number) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </span>
              )}
              {day.hotel?.address && (
                <span className="text-xs text-muted-foreground">{day.hotel.address}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{day.roomType} × {day.roomsCount}</p>
            <p className="text-sm font-semibold">₹{Number(day.ratePerRoom).toLocaleString("en-IN")}/room</p>
            <p className="text-xs text-muted-foreground">Total: ₹{Number(day.totalCost).toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* Meals */}
        {day.meals?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {day.meals.map((meal: any) => (
              <div key={meal.id} className="bg-muted/20 rounded-md px-2.5 py-2 border text-center">
                <p className="text-xs font-medium capitalize">{meal.mealType.toLowerCase()}</p>
                <p className="text-xs text-muted-foreground">{meal.foodPreference}</p>
                <p className="text-xs font-semibold mt-0.5">₹{Number(meal.ratePerPerson).toLocaleString("en-IN")}/pax</p>
                <p className="text-xs text-muted-foreground">× {travellers} = ₹{Number(meal.totalCost).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}

        {day.notes && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
            Note: {day.notes}
          </p>
        )}
      </div>

      {/* Swap Hotel Dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Change Hotel — Day {day.dayNumber} ({day.cityName})</DialogTitle>
            <DialogDescription>
              Select a nearby hotel to replace {day.hotel?.name}. Only hotels in {day.cityName} are shown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingHotels ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Hotel</Label>
                  <Select value={selectedHotelId} onValueChange={(v) => {
                    setSelectedHotelId(v);
                    setSelectedRoomType("");
                    setSelectedRate(0);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a hotel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nearbyHotels.map((h) => (
                        <SelectItem key={h.id} value={String(h.id)}>
                          <div className="flex items-center gap-2">
                            <span>{h.name}</span>
                            {h.star_rating && (
                              <span className="text-xs text-muted-foreground">({h.star_rating}★)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedHotelData && (
                  <div className="space-y-2">
                    <Label>Room Type</Label>
                    <Select value={selectedRoomType} onValueChange={(v) => {
                      setSelectedRoomType(v);
                      const room = selectedHotelData.room_pricing.find((r: any) => r.room_type === v);
                      setSelectedRate(room ? Number(room.rate_per_night) : 0);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose room type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedHotelData.room_pricing.map((r: any) => (
                          <SelectItem key={r.id} value={r.room_type}>
                            {r.room_type} — ₹{Number(r.rate_per_night).toLocaleString("en-IN")}/night
                            (max {r.max_occupancy} pax)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedRate > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {day.roomsCount} room(s) × ₹{selectedRate.toLocaleString("en-IN")} =
                        <strong className="text-foreground ml-1">
                          ₹{(day.roomsCount * selectedRate).toLocaleString("en-IN")}
                        </strong>
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reason for change (optional)</Label>
                  <Textarea
                    placeholder="Hotel fully booked, price mismatch, customer request..."
                    value={swapNote}
                    onChange={(e) => setSwapNote(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSwap}
              disabled={isPending || !selectedHotelId || !selectedRoomType}
            >
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Cab Leg Panel ─────────────────────────────────────────────────────────────

const CAB_TYPES = [
  { value: "SEDAN",            label: "Sedan",            capacity: 4  },
  { value: "HATCHBACK",        label: "Hatchback",        capacity: 4  },
  { value: "SUV",              label: "SUV",              capacity: 6  },
  { value: "INNOVA",           label: "Innova Crysta",    capacity: 6  },
  { value: "ERTIGA",           label: "Ertiga",           capacity: 6  },
  { value: "WAGON_R",          label: "Wagon R",          capacity: 4  },
  { value: "BOLERO",           label: "Bolero",           capacity: 7  },
  { value: "TEMPO_TRAVELLER",  label: "Tempo Traveller",  capacity: 12 },
  { value: "MINI_VAN",         label: "Mini Van",         capacity: 9  },
  { value: "BUS",              label: "Bus",              capacity: 40 },
];

export function CabLegPanel({
  leg, bookingId, travellers,
}: {
  leg: any;
  bookingId: string;
  travellers: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [driverName, setDriverName] = useState(leg.driverName ?? "");
  const [driverPhone, setDriverPhone] = useState(leg.driverPhone ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(leg.vehicleNumber ?? "");
  const [legNotes, setLegNotes] = useState(leg.notes ?? "");
  const [newCabType, setNewCabType] = useState(leg.cabType);
  const [newRate, setNewRate] = useState(String(leg.ratePerCab ?? 0));
  const [changeNote, setChangeNote] = useState("");
  const [isPending, start] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmBookingCabLeg(
        leg.id, bookingId,
        driverName || undefined, driverPhone || undefined,
        vehicleNumber || undefined, legNotes || undefined
      );
      if (r.success) {
        toast.success(`Leg ${leg.legNumber} confirmed`);
        setConfirmOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const handleChange = () => {
    const cabInfo = CAB_TYPES.find((c) => c.value === newCabType);
    if (!cabInfo || !newRate) { toast.error("Select cab type and rate"); return; }
    start(async () => {
      const r = await updateCabType(
        leg.id, bookingId, newCabType as any,
        cabInfo.capacity, Number(newRate), changeNote || undefined
      );
      if (r.success) {
        toast.success("Cab updated");
        setChangeOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  return (
    <>
      <div className={`rounded-lg border p-4 space-y-3 ${leg.isConfirmed ? "bg-green-50/50 border-green-200" : "bg-card"}`}>
        {/* Leg header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
              L{leg.legNumber}
            </div>
            <div>
              <p className="text-sm font-medium">
                {leg.fromLocation} <span className="text-muted-foreground">→</span> {leg.toLocation}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(leg.transferDate), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {leg.isConfirmed ? (
              <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmed
              </span>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => setChangeOpen(true)} disabled={isPending}>
                  <Pencil className="h-3 w-3 mr-1" /> Change
                </Button>
                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setConfirmOpen(true)} disabled={isPending}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Cab info */}
        <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5 border">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {CAB_TYPES.find((c) => c.value === leg.cabType)?.label ?? leg.cabType}
            </p>
            <p className="text-xs text-muted-foreground">
              {leg.cabCount} cab(s) × {leg.capacity} capacity = {leg.cabCount * leg.capacity} pax max
              {travellers > leg.cabCount * leg.capacity && (
                <span className="text-red-500 ml-1">(⚠ insufficient capacity)</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">₹{Number(leg.ratePerCab).toLocaleString("en-IN")}/cab</p>
            <p className="text-xs text-muted-foreground">
              Total: ₹{Number(leg.totalCost).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Driver info if confirmed */}
        {leg.isConfirmed && (leg.driverName || leg.vehicleNumber) && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {leg.driverName && (
              <div className="bg-muted/20 rounded px-2 py-1.5 border">
                <p className="text-muted-foreground">Driver</p>
                <p className="font-medium">{leg.driverName}</p>
              </div>
            )}
            {leg.driverPhone && (
              <div className="bg-muted/20 rounded px-2 py-1.5 border">
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{leg.driverPhone}</p>
              </div>
            )}
            {leg.vehicleNumber && (
              <div className="bg-muted/20 rounded px-2 py-1.5 border">
                <p className="text-muted-foreground">Vehicle</p>
                <p className="font-medium">{leg.vehicleNumber}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Cab — Leg {leg.legNumber}</DialogTitle>
            <DialogDescription>
              {leg.fromLocation} → {leg.toLocation} on {format(new Date(leg.transferDate), "dd MMM yyyy")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Driver Name</Label>
                <Input placeholder="Ramesh Kumar" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Driver Phone</Label>
                <Input placeholder="+91-9876543210" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Vehicle Number</Label>
              <Input placeholder="HP 03 AB 1234" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Pickup point, timing notes..." value={legNotes}
                onChange={(e) => setLegNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Confirm Cab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Cab Dialog */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Change Cab Type — Leg {leg.legNumber}</DialogTitle>
            <DialogDescription>{leg.fromLocation} → {leg.toLocation}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Cab Type</Label>
              <Select value={newCabType} onValueChange={setNewCabType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAB_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label} (max {c.capacity} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rate per Cab per Day (₹)</Label>
              <Input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="4500" />
            </div>
            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Textarea placeholder="Previous cab unavailable, customer requested upgrade..."
                value={changeNote} onChange={(e) => setChangeNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button onClick={handleChange} disabled={isPending}>
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Update Cab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Ops Action Panel ──────────────────────────────────────────────────────────

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
        {(booking as any).rejectionReason && (
          <p className="text-xs text-red-700 mt-0.5">{(booking as any).rejectionReason}</p>
        )}
      </div>
    );
  }

  const canConfirm = booking.hotelConfirmedAt && booking.cabConfirmedAt;

  const handleConfirm = () => {
    start(async () => {
      const r = await confirmBooking(booking.id, note || undefined);
      if (r.success) { toast.success("Booking confirmed"); setConfirmOpen(false); router.refresh(); }
      else toast.error(r.error);
    });
  };

  const handleReject = () => {
    if (!reason.trim()) { toast.error("Rejection reason required"); return; }
    start(async () => {
      const r = await rejectBooking(booking.id, reason);
      if (r.success) { toast.success("Booking rejected"); setRejectOpen(false); router.refresh(); }
      else toast.error(r.error);
    });
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
          <p className="text-sm text-orange-800 font-medium flex-1">
            {canConfirm ? "All verifications done — ready to confirm" : "Awaiting hotel and cab verification"}
          </p>
          <Button size="sm" variant="outline"
            onClick={() => setRejectOpen(true)} disabled={isPending}
            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50">
            <XCircle className="h-3 w-3 mr-1" /> Reject
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)}
            disabled={isPending || !canConfirm}
            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
          </Button>
        </div>
        {!canConfirm && (
          <p className="text-xs text-muted-foreground px-1">
            Hotel verified: {booking.hotelConfirmedAt ? "✓" : "✗"} &nbsp;·&nbsp;
            Cab verified: {booking.cabConfirmedAt ? "✓" : "✗"}
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>Sends confirmation email to customer with hotel and cab details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Message to customer (optional)</Label>
            <Textarea placeholder="Any special instructions..." value={note}
              onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white">
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
            <DialogDescription>Customer will be notified and refund will be initiated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Rejection Reason *</Label>
            <Textarea placeholder="Dates unavailable, package discontinued..."
              value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={handleReject} disabled={isPending} variant="destructive">
              {isPending && <RefreshCw className="h-3 w-3 animate-spin mr-2" />}
              Reject & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Assign Member ─────────────────────────────────────────────────────────────

export function AssignMemberPanel({
  booking, members,
}: {
  booking: BookingWithRelations;
  members: { id: string; name: string; department: { id: string; name: string } | null }[];
}) {
  const [selected, setSelected] = useState(booking.currentAssigneeId ?? "");
  const [isPending, start] = useTransition();
  const router = useRouter();

  const handle = () => {
    if (!selected) return;
    start(async () => {
      const r = await assignMember(booking.id, selected);
      if (r.success) { toast.success("Member assigned"); router.refresh(); }
      else toast.error(r.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="h-8 text-xs flex-1">
          <SelectValue placeholder="Assign to..." />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              {m.name}{m.department && <span className="text-muted-foreground ml-1">· {m.department.name}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handle}
        disabled={isPending || !selected || selected === booking.currentAssigneeId}
        className="h-8 text-xs shrink-0">
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
      if (r.success) { toast.success("Note added"); setNote(""); router.refresh(); }
      else toast.error(r.error);
    });
  };

  return (
    <div className="space-y-2">
      <Textarea placeholder="Add internal note..." value={note}
        onChange={(e) => setNote(e.target.value)} rows={2} className="text-sm resize-none" />
      <Button size="sm" onClick={handle} disabled={isPending || !note.trim()} className="h-8 text-xs">
        {isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
        Add Note
      </Button>
    </div>
  );
}