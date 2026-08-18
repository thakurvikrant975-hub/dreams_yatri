"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Pencil, MapPin, Users, Calendar, Globe, MessageSquare, User, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogTrigger, DialogDescription,
} from "../../components/ui/dialog";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
    updateQuery,
    getDestinationsForQuery,
    getPackagesByDestination,
    type PackageQuery,
    type DestinationOption,
    type PackageOption,
} from "./actions";
import { PhoneInput } from "./PhoneInput";

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

const SOURCES = [
    { label: "Phone Call",       value: "PHONE_CALL" },
    { label: "WhatsApp Meta",    value: "WHATSAPP" },
    { label: "WhatsApp Google",  value: "WHATSAPP_GOOGLE" },
    { label: "Meta",             value: "META" },
    { label: "Website Form",     value: "WEBSITE_FORM" },
    { label: "Landing Page",     value: "LANDING_PAGE" },
    { label: "Referral",         value: "REFERRAL" },
    { label: "Other",            value: "OTHER" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    query: PackageQuery;
    children: React.ReactNode;
    onDone?: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function EditQueryDialog({ query, children, onDone }: Props) {
    const [open, setOpen]               = useState(false);
    const [isPending, startTransition]  = useTransition();
    const [errors, setErrors]           = useState<Record<string, string[]>>({});
    const [source, setSource]           = useState(query.source);
    const [differentWhatsapp, setDifferentWhatsapp] = useState(!query.whatsappSameAsPhone);

    const [destinations, setDestinations] = useState<DestinationOption[]>([]);
    const [packages, setPackages]         = useState<PackageOption[]>([]);
    const [loadingDests, setLoadingDests] = useState(false);
    const [loadingPkgs, setLoadingPkgs]   = useState(false);

    /**
     * FIX: Track destination as a single composite string "id::name".
     * Using "" means "not selected yet / loading".
     * This avoids the bug where selectedDestId was null during the async load,
     * causing the Select to show the placeholder instead of the saved value.
     */
    const [destValue, setDestValue]      = useState<string>("");   // "id::name"
    const [selectedPkgTitle, setSelectedPkgTitle] = useState<string>("");

    // This dialog is reused as a single component instance across different
    // queries (e.g. Querydetailsheet swaps its `query` prop without
    // unmounting), and React 18 Strict Mode double-invokes this effect on
    // mount in dev. A `cancelled` flag set in the cleanup — rather than a
    // ref bumped ad hoc — is the standard React pattern for this: the
    // cleanup fires deterministically between the two Strict Mode
    // invocations (or when a newer query opens), so a torn-down run's
    // fetch can never land after a fresher one, and each run's own state
    // resets (including loadingPkgs, which previously wasn't reset here —
    // a dropped stale response left the Package select stuck on "Loading…").
    const requestIdRef = useRef(0); // still used by handleDestChange below

    // ── Reset & pre-populate on open ─────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        requestIdRef.current++; // invalidate any fetch handleDestChange kicked off for a prior query

        // Reset to saved values immediately (before async)
        // We keep the text visible while destinations are loading.
        setDestValue("");            // cleared until we confirm the ID from DB
        setSelectedPkgTitle(query.packageName ?? "");
        setPackages([]);
        setLoadingPkgs(false);
        setErrors({});
        setSource(query.source);
        setDifferentWhatsapp(!query.whatsappSameAsPhone);

        setLoadingDests(true);
        getDestinationsForQuery().then((dests) => {
            if (cancelled) return;
            setDestinations(dests);
            setLoadingDests(false);

            if (!query.destination) return;

            // Match the saved destination name to get its numeric id
            const match = dests.find((d) => d.name === query.destination);
            if (!match) {
                // Destination no longer exists in DB — show it as plain text fallback
                // (the Select won't be able to select it, but we still send the name on submit)
                return;
            }

            // FIX: Set the composite value so the Select immediately shows the right item
            setDestValue(`${match.id}::${match.name}`);

            if (!query.packageName) return;

            // Load packages for this destination
            setLoadingPkgs(true);
            getPackagesByDestination(match.id).then((pkgs) => {
                if (cancelled) return;
                setPackages(pkgs);
                setLoadingPkgs(false);

                // FIX: Match on trimmed title to avoid whitespace issues
                const pkgMatch = pkgs.find(
                    (p) => p.title.trim() === query.packageName!.trim(),
                );
                if (pkgMatch) {
                    setSelectedPkgTitle(pkgMatch.title);
                }
                // If no match, keep the original saved title so it stays visible below the select
            });
        });

        return () => { cancelled = true; };
    }, [open, query.id]); // query.id as dep so re-opening for a different query resets properly

    // ── Helpers derived from destValue ────────────────────────────────────────

    function parseDestValue(val: string): { id: number; name: string } | null {
        if (!val) return null;
        const [idStr, ...rest] = val.split("::");
        const id = parseInt(idStr, 10);
        if (isNaN(id)) return null;
        return { id, name: rest.join("::") };
    }

    const parsedDest = parseDestValue(destValue);

    // ── Destination change by user interaction ────────────────────────────────

    function handleDestChange(value: string) {
        const id = ++requestIdRef.current; // invalidate any in-flight fetch (initial load or a prior selection)
        setDestValue(value);
        setSelectedPkgTitle("");   // clear package selection when dest changes
        setPackages([]);

        const parsed = parseDestValue(value);
        if (!parsed) return;

        setLoadingPkgs(true);
        getPackagesByDestination(parsed.id).then((pkgs) => {
            if (id !== requestIdRef.current) return; // stale — destination changed again since
            setPackages(pkgs);
            setLoadingPkgs(false);
        });
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("source", source);
        // Send the destination name (not the composite id::name value)
        formData.set("destination", parsedDest?.name ?? query.destination ?? "");
        formData.set("packageName", selectedPkgTitle);

        startTransition(async () => {
            try {
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
            } catch (err) {
                // Network/serialization failure calling the server action —
                // catch it here so the dialog stays open with the user's
                // input intact instead of crashing/unmounting the form.
                console.error("[EditQueryDialog] updateQuery failed:", err);
                toast.error("Failed to save changes — please try again.");
            }
        });
    }

    const travelDateValue = query.travelDate
        ? new Date(query.travelDate).toISOString().split("T")[0]
        : "";

    // ── Render ────────────────────────────────────────────────────────────────

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

                    <SectionLabel icon={User} label="Lead Information" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="edit-name">Full Name <span className="text-dashboard-base-content/40 font-normal">(optional)</span></Label>
                            <Input id="edit-name" name="name" defaultValue={query.name} autoComplete="off" />
                            <FieldError errors={errors} field="name" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <Label>Phone <span className="text-destructive">*</span></Label>
                            <PhoneInput name="phone" defaultValue={query.phone} />
                            <FieldError errors={errors} field="phone" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> WhatsApp number is different
                                </Label>
                                <Switch
                                    size="sm"
                                    checked={differentWhatsapp}
                                    onCheckedChange={setDifferentWhatsapp}
                                />
                            </div>
                            <input type="hidden" name="whatsappSameAsPhone" value={String(!differentWhatsapp)} />
                            {differentWhatsapp ? (
                                <>
                                    <PhoneInput name="whatsapp" defaultValue={query.whatsapp ?? ""} placeholder="WhatsApp number" />
                                    <FieldError errors={errors} field="whatsapp" />
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">Same as phone number</p>
                            )}
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input id="edit-email" name="email" type="email" defaultValue={query.email ?? ""} />
                            <FieldError errors={errors} field="email" />
                        </div>
                    </div>

                    <SectionLabel icon={MapPin} label="Package Details" />

                    <div className="grid grid-cols-2 gap-3">

                        {/* ── Destination ── */}
                        <div className="space-y-1.5">
                            <Label>
                                Destination <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                            </Label>
                            <Select
                                value={destValue}
                                onValueChange={handleDestChange}
                                disabled={loadingDests}
                            >
                                <SelectTrigger>
                                    {loadingDests ? (
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                                        </span>
                                    ) : (
                                        <SelectValue placeholder="Select destination (optional)" />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {destinations.map((d) => (
                                        <SelectItem key={d.id} value={`${d.id}::${d.name}`}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError errors={errors} field="destination" />
                            {/*
                             * FIX: Show fallback text ONLY when destinations have loaded
                             * but the saved destination didn't match any option (e.g. deleted dest).
                             * Previously this showed even when the select was pre-populated correctly.
                             */}
                            {!loadingDests && !destValue && query.destination && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <span>⚠</span> Current: <span className="font-medium">{query.destination}</span> (not found in active list)
                                </p>
                            )}
                        </div>

                        {/* ── Package ── */}
                        <div className="space-y-1.5">
                            <Label>Package</Label>
                            <Select
                                value={selectedPkgTitle}
                                onValueChange={setSelectedPkgTitle}
                                disabled={!parsedDest || loadingPkgs}
                            >
                                <SelectTrigger>
                                    {loadingPkgs ? (
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                                        </span>
                                    ) : (
                                        <SelectValue
                                            placeholder={
                                                !parsedDest
                                                    ? "Select destination first"
                                                    : "Select package"
                                            }
                                        />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                    {packages.map((p) => (
                                        <SelectItem key={p.id} value={p.title}>
                                            {p.title}
                                        </SelectItem>
                                    ))}
                                    {!loadingPkgs && parsedDest && packages.length === 0 && (
                                        <SelectItem value="__none__" disabled>
                                            No packages for this destination
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {/*
                             * FIX: Show fallback only when packages loaded but title unmatched.
                             * Previously showed on every open because selectedPkgTitle was briefly "".
                             */}
                            {!loadingPkgs && parsedDest && !selectedPkgTitle && query.packageName && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <span>⚠</span> Current: <span className="font-medium">{query.packageName}</span> (not in list)
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-groupSize">
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> No of travellers
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

                    <SectionLabel icon={Globe} label="Source" />

                    <div className="space-y-1.5">
                        <Label>How did they reach us?</Label>
                        <div className="flex flex-wrap gap-2">
                            {SOURCES.map((s) => (
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

                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            <Pencil className="h-3.5 w-3.5" />
                            {isPending ? "Saving…" : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}