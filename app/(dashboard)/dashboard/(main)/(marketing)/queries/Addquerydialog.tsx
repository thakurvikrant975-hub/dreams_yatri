"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Phone, User, Mail, MapPin, Users, Calendar, MessageSquare, Globe, Tag } from "lucide-react";
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
import { createManualQuery, type ManualQueryFormState } from "./actions";

// ── Field Error ───────────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
    const msgs = errors?.[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>;
}

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {label}
            </span>
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

// ── Destinations list ─────────────────────────────────────────────────────────

const DESTINATIONS = [
    "Kashmir", "Himachal Pradesh", "Uttarakhand", "Rajasthan",
    "Goa", "Kerala", "Northeast India", "Sikkim",
    "Ladakh", "Spiti Valley", "Andaman", "Karnataka",
    "Dubai", "Thailand", "Other",
];

const SOURCES = [
    { label: "Phone Call",    value: "PHONE_CALL" },
    { label: "WhatsApp",      value: "WHATSAPP" },
    { label: "Website Form",  value: "WEBSITE_FORM" },
    { label: "Landing Page",  value: "LANDING_PAGE" },
    { label: "Referral",      value: "REFERRAL" },
    { label: "Other",         value: "OTHER" },
];

// ── Initial State ─────────────────────────────────────────────────────────────

const initial: ManualQueryFormState = { success: false, message: "" };

// ── Dialog ────────────────────────────────────────────────────────────────────

export function AddQueryDialog() {
    const [open, setOpen]           = useState(false);
    const [source, setSource]       = useState("PHONE_CALL");
    const [destination, setDest]    = useState("");
    const formRef                   = useRef<HTMLFormElement>(null);
    const [state, action, isPending] = useActionState(createManualQuery, initial);

    useEffect(() => {
        if (state.success) {
            toast.success(state.message);
            setOpen(false);
            setSource("PHONE_CALL");
            setDest("");
            formRef.current?.reset();
        } else if (state.message && !state.errors) {
            toast.error(state.message);
        }
    }, [state]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Query
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Phone className="h-4 w-4 text-primary" />
                        </div>
                        Add Manual Query
                    </DialogTitle>
                    <DialogDescription>
                        Manually enter lead details from a phone call or walk-in enquiry.
                    </DialogDescription>
                </DialogHeader>

                <form ref={formRef} action={action} className="space-y-4 pt-1">

                    {/* ── Lead Info ── */}
                    <SectionLabel icon={User} label="Lead Information" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="name">
                                Full Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name" name="name"
                                placeholder="e.g. Rahul Sharma"
                                autoComplete="off"
                            />
                            <FieldError errors={state.errors} field="name" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="phone">
                                Phone <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="phone" name="phone"
                                placeholder="+91 98765 43210"
                                autoComplete="off"
                            />
                            <FieldError errors={state.errors} field="phone" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email" name="email"
                                type="email"
                                placeholder="rahul@gmail.com"
                            />
                            <FieldError errors={state.errors} field="email" />
                        </div>
                    </div>

                    {/* ── Package Info ── */}
                    <SectionLabel icon={MapPin} label="Package Details" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="destination">Destination</Label>
                            {/* Hidden input carries the value for form action */}
                            <input type="hidden" name="destination" value={destination} />
                            <Select value={destination} onValueChange={setDest}>
                                <SelectTrigger id="destination">
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
                            <Label htmlFor="packageName">Package Name</Label>
                            <Input
                                id="packageName" name="packageName"
                                placeholder="e.g. Kashmir Honeymoon 7N"
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="groupSize">
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Group Size
                                </span>
                            </Label>
                            <Input
                                id="groupSize" name="groupSize"
                                type="number" min="1" max="100"
                                placeholder="e.g. 4"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="travelDate">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Travel Date
                                </span>
                            </Label>
                            <Input
                                id="travelDate" name="travelDate"
                                type="date"
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
                                    onClick={() => setSource(s.value)}
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
                        <Label htmlFor="message">What did they enquire about?</Label>
                        <Textarea
                            id="message" name="message"
                            placeholder="e.g. Looking for a 7-day Kashmir honeymoon package in June, budget around 1.2L for 2..."
                            rows={3}
                            className="resize-none text-sm"
                        />
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button
                            type="button" variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            {isPending ? "Saving..." : "Save Query"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}