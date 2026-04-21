"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Phone, User, MapPin, Users, Calendar, MessageSquare, Globe, Loader2 } from "lucide-react";import { toast } from "sonner";
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
import {
    getDestinationsForQuery,
    getPackagesByDestination,
    type DestinationOption,
    type PackageOption,
} from "./actions";
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

const SOURCES = [
    { label: "Phone Call", value: "PHONE_CALL" },
    { label: "WhatsApp", value: "WHATSAPP" },
    { label: "Meta", value: "META" },
    { label: "Website Form", value: "WEBSITE_FORM" },
    { label: "Landing Page", value: "LANDING_PAGE" },
    { label: "Referral", value: "REFERRAL" },
    { label: "Other", value: "OTHER" },
];

// ── Initial State ─────────────────────────────────────────────────────────────

const initial: ManualQueryFormState = { success: false, message: "" };

// ── Dialog ────────────────────────────────────────────────────────────────────
export function AddQueryDialog() {
    const [open, setOpen]                         = useState(false);
    const [source, setSource]                     = useState("PHONE_CALL");
    const [selectedDestId, setSelectedDestId]     = useState<number | null>(null);
    const [selectedDestName, setSelectedDestName] = useState("");
    const [selectedPkgTitle, setSelectedPkgTitle] = useState("");
    const [destinations, setDestinations]         = useState<DestinationOption[]>([]);
    const [packages, setPackages]                 = useState<PackageOption[]>([]);
    const [loadingDests, setLoadingDests]         = useState(false);
    const [loadingPkgs, setLoadingPkgs]           = useState(false);
    const formRef                                 = useRef<HTMLFormElement>(null);
    const [state, action, isPending]              = useActionState(createManualQuery, initial);

    useEffect(() => {
        if (!open) return;
        setLoadingDests(true);
        getDestinationsForQuery()
            .then(setDestinations)
            .finally(() => setLoadingDests(false));
    }, [open]);

    useEffect(() => {
        if (!selectedDestId) { setPackages([]); setSelectedPkgTitle(""); return; }
        setLoadingPkgs(true);
        setSelectedPkgTitle("");
        getPackagesByDestination(selectedDestId)
            .then(setPackages)
            .finally(() => setLoadingPkgs(false));
    }, [selectedDestId]);

    useEffect(() => {
        if (state.success) {
            toast.success(state.message);
            setOpen(false);
            setSource("PHONE_CALL");
            setSelectedDestId(null);
            setSelectedDestName("");
            setSelectedPkgTitle("");
            setPackages([]);
            formRef.current?.reset();
        } else if (state.message && !state.errors) {
            toast.error(state.message);
        }
    }, [state]);

    function handleDestChange(value: string) {
        const [idStr, ...rest] = value.split("::");
        setSelectedDestId(parseInt(idStr));
        setSelectedDestName(rest.join("::"));
    }

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
                    <input type="hidden" name="destination" value={selectedDestName} />
                    <input type="hidden" name="packageName" value={selectedPkgTitle} />
                    <input type="hidden" name="source"      value={source} />

                    <SectionLabel icon={User} label="Lead Information" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                            <Input id="name" name="name" placeholder="e.g. Rahul Sharma" autoComplete="off" />
                            <FieldError errors={state.errors} field="name" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                            <Input id="phone" name="phone" placeholder="+91 98765 43210" autoComplete="off" />
                            <FieldError errors={state.errors} field="phone" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="rahul@gmail.com" />
                        </div>
                    </div>

                    <SectionLabel icon={MapPin} label="Package Details" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Destination</Label>
                            <Select
                                value={selectedDestId ? `${selectedDestId}::${selectedDestName}` : ""}
                                onValueChange={handleDestChange}
                                disabled={loadingDests}
                            >
                                <SelectTrigger>
                                    {loadingDests
                                        ? <span className="flex items-center gap-1.5 text-muted-foreground text-sm"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                                        : <SelectValue placeholder="Select destination" />
                                    }
                                </SelectTrigger>
                                <SelectContent>
                                    {destinations.map(d => (
                                        <SelectItem key={d.id} value={`${d.id}::${d.name}`}>{d.name}</SelectItem>
                                    ))}
                                    {!loadingDests && destinations.length === 0 && (
                                        <SelectItem value="__none__" disabled>No destinations found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Package</Label>
                            <Select
                                value={selectedPkgTitle}
                                onValueChange={setSelectedPkgTitle}
                                disabled={!selectedDestId || loadingPkgs}
                            >
                                <SelectTrigger>
                                    {loadingPkgs
                                        ? <span className="flex items-center gap-1.5 text-muted-foreground text-sm"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>
                                        : <SelectValue placeholder={!selectedDestId ? "Select destination first" : "Select package"} />
                                    }
                                </SelectTrigger>
                                <SelectContent>
                                    {packages.map(p => (
                                        <SelectItem key={p.id} value={p.title}>{p.title}</SelectItem>
                                    ))}
                                    {!loadingPkgs && selectedDestId && packages.length === 0 && (
                                        <SelectItem value="__none__" disabled>No packages for this destination</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="groupSize">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> No of travellers</span>
                            </Label>
                            <Input id="groupSize" name="groupSize" type="number" min="1" max="100" placeholder="e.g. 4" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="travelDate">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Travel Date</span>
                            </Label>
                            <Input id="travelDate" name="travelDate" type="date" />
                        </div>
                    </div>

                    <SectionLabel icon={Globe} label="Source" />

                    <div className="space-y-1.5">
                        <Label>How did they reach us?</Label>
                        <div className="flex flex-wrap gap-2">
                            {SOURCES.map(s => (
                                <button key={s.value} type="button" onClick={() => setSource(s.value)}
                                    className={[
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                        source === s.value
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted border-border text-muted-foreground",
                                    ].join(" ")}
                                >{s.label}</button>
                            ))}
                        </div>
                    </div>

                    <SectionLabel icon={MessageSquare} label="Notes / Message" />

                    <div className="space-y-1.5">
                        <Label htmlFor="message">What did they enquire about?</Label>
                        <Textarea id="message" name="message"
                            placeholder="e.g. Looking for a 7-day Kashmir honeymoon package in June..."
                            rows={3} className="resize-none text-sm" />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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