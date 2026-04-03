"use client";

import { useTransition }   from "react";
import Link                from "next/link";
import { Badge }           from "../components/ui/badge";
import { Button }          from "../components/ui/button";
import { Switch }          from "../components/ui/switch";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Hotel, Pencil, Trash2, BedDouble, ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast }  from "sonner";
import { toggleHotelActive, deleteHotel } from "./actions";

const CATEGORY_LABELS: Record<string, string> = {
  hotel:     "Hotel",
  resort:    "Resort",
  houseboat: "Houseboat",
  villa:     "Villa",
  homestay:  "Homestay",
};

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

type HotelItem = {
  id:          number;
  name:        string;
  slug:        string;
  thumbnail:   string | null;
  category:    string | null;
  star_rating: number | null;
  is_active:   boolean;
  created_at:  Date;
  destination: { id: number; name: string };
  _count:      { room_pricing: number; images: number; packages: number };
};

export function HotelsTableClient({ hotels }: { hotels: HotelItem[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: number, current: boolean) {
    startTransition(async () => {
      await toggleHotelActive(id, !current);
      toast.success(`Hotel ${!current ? "activated" : "deactivated"}`);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteHotel(id);
      if (result.success) toast.success(result.message);
      else                toast.error(result.message);
    });
  }

  if (hotels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
        <Hotel className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No hotels yet</p>
        <p className="text-xs text-muted-foreground mt-1">Click "Add Hotel" to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[260px]">Hotel</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-center">Rooms</TableHead>
            <TableHead className="text-center">Images</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotels.map(hotel => {
            const stars = hotel.star_rating ? "★".repeat(hotel.star_rating) : null;

            return (
              <TableRow key={hotel.id} className="hover:bg-muted/30">
                {/* Hotel name + thumbnail */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    {hotel.thumbnail ? (
                      <img
                        src={`${base}/${hotel.thumbnail}`}
                        alt={hotel.name}
                        className="h-12 w-16 rounded-lg object-cover shrink-0 border"
                      />
                    ) : (
                      <div className="h-12 w-16 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                        <Hotel className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{hotel.name}</p>
                      {stars && <p className="text-xs text-amber-500">{stars}</p>}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {hotel.destination.name}
                  </Badge>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {CATEGORY_LABELS[hotel.category ?? ""] ?? hotel.category ?? "—"}
                </TableCell>

                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{hotel._count.room_pricing}</span>
                  </div>
                </TableCell>

                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{hotel._count.images}</span>
                  </div>
                </TableCell>

                <TableCell className="text-center">
                  <Switch
                    checked={hotel.is_active}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(hotel.id, hotel.is_active)}
                  />
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/dashboard/hotels/${hotel.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Hotel</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete <span className="font-semibold">{hotel.name}</span>? This will
                            permanently remove all rooms, images and categories from R2 and DB.
                            {hotel._count.packages > 0 && (
                              <span className="block mt-2 text-destructive font-medium">
                                ⚠ Used in {hotel._count.packages} package(s). Remove from packages first.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(hotel.id)}
                            disabled={hotel._count.packages > 0 || isPending}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}