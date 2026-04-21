"use client";

import { useState, useTransition } from "react";
import { Pencil, MapPin, Users, Calendar, Globe, MessageSquare, User, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { updateQuery } from "./actions";
import type { PackageQuery } from "./actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
    const msgs = errors?.[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 pt-1">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {label}
            </span>
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

const DESTINATIONS = [
    "Kashmir", "Himachal Pradesh", "Uttarakhand", "Rajasthan",
    "Goa", "Kerala", "Northeast India", "Sikkim",
    "Ladakh", "Spiti Valley", "Andaman", "Karnataka",
    "Dubai", "Thailand", "Other",
];

const SOURCES = [
    { label: "Phone Call",   value: "PHONE_CALL" },
    { label: "WhatsApp",     value: "WHATSAPP" },
    { label: "Website Form", value: "WEBSITE_FORM" },
    { label: "Landing Page", value: "LANDING_PAGE" },
    { label: "Referral",     value: "REFERRAL" },
    { label: "Other",        value: "OTHER" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    query:    PackageQuery;
    children: React.ReactNode;
    onDone?:  () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EditQueryDialog({ query, children, onDone }: Props) {
    const [open, setOpen]           = useState(false);
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors]       = useState<Record<string, string[]>>({});
    const [source, setSource]       = useState(query.source);
    const [destination, setDest]    = useState(query.destination ?? "");

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("source", source);
        formData.set("destination", destination);

        startTransition(async () => {
            const result = await updateQuery(query.id, formData);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                setErrors({});
                onDone?.();
            } else if (result.errors) {
                setErrors(result.errors);
                toast.error(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    // Format date for input[type=date]
    const travelDateValue = query.travelDate
        ? new Date(query.travelDate).toISOString().split("T")[0]
        : "";

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
            <DialogTrigger asChild>{children}</DialogTrigger>

            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Pencil className="h-4 w-4 text-primary" />
                        </div>
                        Edit Query
                    </DialogTitle>
                    <DialogDescription>
                        Update lead details for <span className="font-semibold">{query.name}</span>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">

                    {/* ── Lead Info ── */}
                    <SectionLabel icon={User} label="Lead Information" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="edit-name">
                                Full Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-name"
                                name="name"
                                defaultValue={query.name}
                                autoComplete="off"
                            />
                            <FieldError errors={errors} field="name" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-phone">
                                Phone <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-phone"
                                name="phone"
                                defaultValue={query.phone}
                                autoComplete="off"
                            />
                            <FieldError errors={errors} field="phone" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                defaultValue={query.email ?? ""}
                            />
                            <FieldError errors={errors} field="email" />
                        </div>
                    </div>

                    {/* ── Package Info ── */}
                    <SectionLabel icon={MapPin} label="Package Details" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Destination</Label>
                            <input type="hidden" name="destination" value={destination} />
                            <Select value={destination} onValueChange={setDest}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select destination" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DESTINATIONS.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-packageName">Package Name</Label>
                            <Input
                                id="edit-packageName"
                                name="packageName"
                                defaultValue={query.packageName ?? ""}
                                placeholder="e.g. Kashmir Honeymoon 7N"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-groupSize">
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Group Size
                                </span>
                            </Label>
                            <Input
                                id="edit-groupSize"
                                name="groupSize"
                                type="number"
                                min="1"
                                max="100"
                                defaultValue={query.groupSize ?? ""}
                                placeholder="e.g. 4"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-travelDate">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Travel Date
                                </span>
                            </Label>
                            <Input
                                id="edit-travelDate"
                                name="travelDate"
                                type="date"
                                defaultValue={travelDateValue}
                            />
                        </div>
                    </div>

                    {/* ── Source ── */}
                    <SectionLabel icon={Globe} label="Source" />

                    <div className="space-y-1.5">
                        <Label>How did they reach us?</Label>
                        <input type="hidden" name="source" value={source} />
                        <div className="flex flex-wrap gap-2">
                            {SOURCES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setSource(s.value as PackageQuery["source"])}
                                    className={[
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                        source === s.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted border-border text-muted-foreground",
                                    ].join(" ")}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Message ── */}
                    <SectionLabel icon={MessageSquare} label="Notes / Message" />

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-message">Enquiry Details</Label>
                        <Textarea
                            id="edit-message"
                            name="message"
                            defaultValue={query.message ?? ""}
                            placeholder="What did they enquire about?"
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            <Pencil className="h-3.5 w-3.5" />
                            {isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}