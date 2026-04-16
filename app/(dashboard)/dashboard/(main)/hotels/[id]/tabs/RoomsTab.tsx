"use client";

import { useState, useTransition } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { RoomForm, type RoomRow } from "../../new/RoomPricingSection";

import { createRoom, updateRoom, deleteRoom } from "../../actions";

type DBRoom = {
  id: number;
  room_type: string;
  description: string | null;
  occupancy: number;
  price_per_night: any;
  original_price: any;
  season: string;
  margin_percentage: any;
  is_active: boolean;
  amenities: unknown;
};

function toRoomRow(r: DBRoom): RoomRow {
  return {
    id: r.id,
    room_type: r.room_type,
    description: r.description ?? "",
    occupancy: r.occupancy,
    price_per_night: Number(r.price_per_night),
    original_price: r.original_price ? Number(r.original_price) : undefined,
    season: r.season,
    margin_percentage: Number(r.margin_percentage),
    is_active: r.is_active,
    amenities: Array.isArray(r.amenities) ? r.amenities as string[] : [],
  };
}

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

  function buildFormData(room: RoomRow) {
    const fd = new FormData();
    fd.append("room_type", room.room_type);
    fd.append("description", room.description);
    fd.append("occupancy", String(room.occupancy));
    fd.append("price_per_night", String(room.price_per_night));
    fd.append("original_price", room.original_price ? String(room.original_price) : "");
    fd.append("season", room.season);
    fd.append("margin_percentage", String(room.margin_percentage));
    fd.append("is_active", String(room.is_active));
    fd.append("amenities", JSON.stringify(room.amenities));
    fd.append("sort_order", String(rooms.length));
    return fd;
  }

  function handleAdd(room: RoomRow) {
    startTransition(async () => {
      const result = await createRoom(hotel_id, buildFormData(room));
      if (result.success) {
        toast.success(result.message);
        setAdding(false);
        // Optimistic update — real data revalidated by server
        setRooms(prev => [...prev, {
          id: Date.now(), // temp
          room_type: room.room_type,
          description: room.description || null,
          occupancy: room.occupancy,
          price_per_night: room.price_per_night as unknown as number,
          original_price: room.original_price as unknown as number ?? null,
          season: room.season,
          margin_percentage: room.margin_percentage as unknown as number,
          is_active: room.is_active,
          amenities: room.amenities,
        }]);
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleEdit(room: RoomRow) {
    if (!room.id) return;
    startTransition(async () => {
      const result = await updateRoom(room.id!, hotel_id, buildFormData(room));
      if (result.success) {
        toast.success(result.message);
        setEditId(null);
        setRooms(prev => prev.map(r => r.id === room.id ? {
          ...r,
          room_type: room.room_type,
          description: room.description || null,
          occupancy: room.occupancy,
          price_per_night: room.price_per_night as unknown as number,
          original_price: room.original_price as unknown as number ?? null,
          season: room.season,
          margin_percentage: room.margin_percentage as unknown as number,
          is_active: room.is_active,
          amenities: room.amenities,
        } : r));
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteRoom(id, hotel_id);
      if (result.success) {
        toast.success(result.message);
        setRooms(prev => prev.filter(r => r.id !== id));
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Room Pricing</CardTitle>
            <CardDescription>{rooms.length} room type{rooms.length !== 1 ? "s" : ""}</CardDescription>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Room
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add room form */}
        {adding && (
          <RoomForm
            initial={{ room_type: "", description: "", occupancy: 2, price_per_night: 0, season: "all", margin_percentage: 10, is_active: true, amenities: [] }}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* Rooms table */}
        {rooms.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Room Type</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead className="text-right">Price/Night</TableHead>
                  <TableHead className="text-center">Guests</TableHead>
                  <TableHead>Amenities</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map(room => (
                  editId === room.id ? (
                    <TableRow key={room.id}>
                      <TableCell colSpan={7} className="p-0">
                        <div className="p-3">
                          <RoomForm
                            initial={toRoomRow(room)}
                            onSave={handleEdit}
                            onCancel={() => setEditId(null)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={room.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{room.room_type}</p>
                          {room.description && (
                            <p className="text-xs text-muted-foreground">{room.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{room.season}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-semibold text-sm">₹{Number(room.price_per_night).toLocaleString()}</p>
                        {room.original_price && (
                          <p className="text-xs text-muted-foreground line-through">
                            ₹{Number(room.original_price).toLocaleString()}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{room.occupancy}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(room.amenities) ? room.amenities as string[] : []).slice(0, 3).map(a => (
                            <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">{a}</Badge>
                          ))}
                          {Array.isArray(room.amenities) && (room.amenities as string[]).length > 3 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              +{(room.amenities as string[]).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`h-2 w-2 rounded-full mx-auto ${room.is_active ? "bg-green-500" : "bg-muted-foreground"}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setEditId(room.id)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="ghost" size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Room</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete <span className="font-semibold">{room.room_type}</span>? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(room.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                ))}
              </TableBody>
            </Table>
          </div>
        ) : !adding && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No rooms added yet</p>
            <p className="text-xs mt-1">Click "Add Room" to add your first room type</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}