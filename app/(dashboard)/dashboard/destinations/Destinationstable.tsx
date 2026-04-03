"use client";

import { useTransition } from "react";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Trash2, MapPin, Package, Hotel, Activity } from "lucide-react";
import { ImageIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { EditDestinationDialog } from "./Destinationdialog";
import { deleteDestination, toggleDestinationActive } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────

type Region = { id: number; name: string; slug: string };

type Destination = {
    id: number;
    name: string;
    slug: string;
    country: string;
    region_id: number;
    description: string | null;
    meta_title: string | null;
    meta_desc: string | null;
    thumbnail: string | null;
    cover_image: string | null;
    is_active: boolean;
    created_at: Date;
    region: { id: number; name: string; slug: string };
    _count: { packages: number; hotels: number; activities: number };
};

// ── Delete Dialog ─────────────────────────────────────────────────────────

function DeleteDestinationDialog({
    id,
    name,
    linkedCount,
}: {
    id: number;
    name: string;
    linkedCount: number;
}) {
    const [isPending, startTransition] = useTransition();

    function handleDelete() {
        startTransition(async () => {
            const result = await deleteDestination(id);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    return (
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
                    <AlertDialogTitle>Delete Destination</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{name}</span>?
                        {linkedCount > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                ⚠ This destination has {linkedCount} linked item(s). Remove them first.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isPending || linkedCount > 0}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ── Table ─────────────────────────────────────────────────────────────────

export function DestinationsTable({
    destinations,
    regions,
}: {
    destinations: Destination[];
    regions: Region[];
}) {
    const [isPending, startTransition] = useTransition();

    function handleToggle(id: number, current: boolean) {
        startTransition(async () => {
            await toggleDestinationActive(id, !current);
            toast.success(`Destination ${!current ? "activated" : "deactivated"}`);
        });
    }

    if (destinations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-muted/30">
                <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No destinations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first destination to get started</p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[220px]">Destination</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cover</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead className="text-center">Linked</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {destinations.map(dest => {
                        const linkedCount = dest._count.packages + dest._count.hotels + dest._count.activities;
                        return (
                            <TableRow key={dest.id} className="hover:bg-muted/30">
                                {/* Name */}
                                {/* thumbnail */}
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        {/* Thumbnail preview */}
                                        {dest.thumbnail ? (
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.thumbnail}`}
                                                alt={dest.name}
                                                className="h-10 w-14 rounded-lg object-cover shrink-0 border"
                                            />
                                        ) : (
                                            <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                                                <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-medium text-sm">{dest.name}</p>
                                            <p className="text-xs text-muted-foreground">{dest.country}</p>
                                        </div>
                                    </div>
                                </TableCell>

                                {/* Slug */}
                                <TableCell>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {dest.slug}
                                    </Badge>
                                </TableCell>


                                {/* Cover image */}
                                <TableCell>
                                    {dest.cover_image ? (
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dest.cover_image}`}
                                            alt={dest.name}
                                            className="h-10 w-14 rounded-lg object-cover shrink-0 border"
                                        />
                                    ) : (
                                        <div className="h-10 w-14 rounded-lg bg-muted border flex items-center justify-center shrink-0">
                                            <ImageIcon weight="duotone" className="size-5.5 text-muted-foreground/70" />
                                        </div>
                                    )}
                                </TableCell>

                                {/* Region */}
                                <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                        {dest.region.name}
                                    </Badge>
                                </TableCell>

                                {/* Linked counts */}
                                <TableCell>
                                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-0.5">
                                            <Package className="h-3 w-3" /> {dest._count.packages}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <Hotel className="h-3 w-3" /> {dest._count.hotels}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <Activity className="h-3 w-3" /> {dest._count.activities}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Status toggle */}
                                <TableCell className="text-center">
                                    <Switch
                                        checked={dest.is_active}
                                        disabled={isPending}
                                        onCheckedChange={() => handleToggle(dest.id, dest.is_active)}
                                    />
                                </TableCell>

                                {/* Added */}
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(dest.created_at), { addSuffix: true })}
                                </TableCell>

                                {/* Actions */}
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <EditDestinationDialog destination={dest} regions={regions} />
                                        <DeleteDestinationDialog
                                            id={dest.id}
                                            name={dest.name}
                                            linkedCount={linkedCount}
                                        />
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