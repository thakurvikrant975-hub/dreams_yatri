"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Phone, User, MapPin, Users, Calendar, MessageSquare, Globe, Loader2, MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
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
import { createManualQuery, checkExistingQueryByPhone, type ManualQueryFormState, type ExistingQueryMatch } from "./actions";
import {
    getDestinationsForQuery, getPackagesByDestination,
    type DestinationOption, type PackageOption,
} from "./actions";
import { PhoneInput } from "./PhoneInput";
import { cn } from "@/app/lib/utils";

// ── Field Error ───────────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors?: Record<string, string[]>; field: string }) {
    const msgs = errors?.[field];
    if (!msgs?.length) return null;
    return (
        <p className="text-xs text-dashboard-error mt-1">{msgs[0]}</p>
    );
}

// ── Section Label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <Icon className="h-3.5 w-3.5 text-dashboard-base-content/75" />
            <span className="text-[10px] font-semibold text-dashboard-base-content/75 uppercase tracking-widest">
                {label}
            </span>
            <div className="flex-1 h-px bg-dashboard-base-300" />
        </div>
    );
}

// Normalizes to Title Case as the exec types — lowercases everything first
// so "MAYANK SHARMA" / "mayank Sharma" / "mayank sharma" all converge on
// "Mayank Sharma" instead of preserving whatever casing was typed. Mirrors
// the server-side normalization in actions.ts (toTitleCase) so what's shown
// here always matches what actually gets saved.
function capitalizeWords(s: string): string {
    return s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
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

const initial: ManualQueryFormState = { success: false, message: "" };

// ── Dialog ────────────────────────────────────────────────────────────────────

export function AddQueryDialog() {
    const [open,               setOpen]               = useState(false);
    const [source,             setSource]             = useState("PHONE_CALL");
    const [selectedDestId,     setSelectedDestId]     = useState<number | null>(null);
    const [selectedDestName,   setSelectedDestName]   = useState("");
    const [selectedPkgTitle,   setSelectedPkgTitle]   = useState("");
    const [destinations,       setDestinations]       = useState<DestinationOption[]>([]);
    const [packages,           setPackages]           = useState<PackageOption[]>([]);
    const [loadingDests,       setLoadingDests]       = useState(false);
    const [loadingPkgs,        setLoadingPkgs]        = useState(false);
    // Controlled (not left as plain uncontrolled <input>s) specifically so a
    // failed submission never wipes what the exec already typed — React
    // form actions reset uncontrolled fields once the action call finishes,
    // success or failure, which previously made a validation error look
    // like the whole form had been silently cleared.
    const [name,               setName]               = useState("");
    const [email,              setEmail]              = useState("");
    const [groupSize,          setGroupSize]          = useState("");
    const [travelDate,         setTravelDate]         = useState("");
    const [message,            setMessage]            = useState("");
    const [phone,              setPhone]              = useState("");
    const [existingMatch,      setExistingMatch]      = useState<ExistingQueryMatch | null>(null);
    const [differentWhatsapp,  setDifferentWhatsapp]  = useState(false);
    const formRef                                     = useRef<HTMLFormElement>(null);
    const [state, action, isPending]                  = useActionState(createManualQuery, initial);

    // Warn as soon as a phone number the exec is typing already has a query
    // on file — catches an about-to-be-created duplicate before it happens,
    // instead of only after the fact via the "N queries" badge in the table.
    useEffect(() => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10) { setExistingMatch(null); return; }
        let cancelled = false;
        const timer = setTimeout(() => {
            checkExistingQueryByPhone(phone).then((match) => {
                if (!cancelled) setExistingMatch(match);
            });
        }, 400);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [phone]);

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
            setName("");
            setEmail("");
            setGroupSize("");
            setTravelDate("");
            setMessage("");
            setPhone("");
            setExistingMatch(null);
            setDifferentWhatsapp(false);
            formRef.current?.reset();
        } else if (state.message) {
            // Always surface a toast on failure — not just when there's no
            // per-field error — since not every validated field (e.g. source)
            // has an inline error shown next to it. Deliberately does NOT
            // touch any of the form state above, so whatever the exec already
            // typed (name, phone, destination, source, notes...) stays put.
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
            {/* ── Trigger ── */}
            <DialogTrigger asChild>
                <Button
                    size="lg"
                    className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 rounded-md transition-all duration-200 hover:scale-[1.02] shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    Add Query
                </Button>
            </DialogTrigger>

            {/* ── Content ── */}
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-dashboard-base-100 border border-dashboard-base-300 rounded-2xl p-0">

                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-dashboard-base-300">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-dashboard-primary/10 flex items-center justify-center shrink-0">
                            <Phone className="h-4 w-4 text-dashboard-primary" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-dashboard-base-content">
                                Add Manual Query
                            </p>
                            <p className="text-xs text-dashboard-base-content/75 font-normal mt-0.5">
                                Manually enter lead details from a phone call or walk-in enquiry.
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {/* Form */}
                <form ref={formRef} action={action} className="px-6 pb-6 space-y-4 pt-4">
                    <input type="hidden" name="destination" value={selectedDestName} />
                    <input type="hidden" name="packageName" value={selectedPkgTitle} />
                    <input type="hidden" name="source"      value={source} />

                    {/* ── Lead Info ── */}
                    <SectionLabel icon={User} label="Lead Information" />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70">
                                Full Name <span className="text-dashboard-base-content/40">(optional — if they haven&apos;t given it yet)</span>
                            </Label>
                            <Input
                                id="name" name="name"
                                value={name}
                                onChange={(e) => setName(capitalizeWords(e.target.value))}
                                placeholder="Rahul Sharma"
                                autoComplete="off"
                                className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content placeholder:text-dashboard-base-content/30 focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary"
                            />
                            <FieldError errors={state.errors} field="name" />
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70">
                                Phone <span className="text-dashboard-error">*</span>
                            </Label>
                            <PhoneInput name="phone" onChange={setPhone} />
                            <FieldError errors={state.errors} field="phone" />
                            {existingMatch && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <p className="text-xs leading-relaxed">
                                        This number is already on file as{" "}
                                        <span className="font-semibold">{existingMatch.name}</span> —{" "}
                                        {existingMatch.assignedToName
                                            ? <>assigned to <span className="font-semibold">{existingMatch.assignedToName}</span>{" "}</>
                                            : "not yet assigned "}
                                        {formatDistanceToNow(new Date(existingMatch.createdAt), { addSuffix: true })}.
                                        Check it&apos;s not a duplicate before saving.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-dashboard-base-content/70 flex items-center gap-1">
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
                                    <PhoneInput name="whatsapp" placeholder="WhatsApp number" />
                                    <FieldError errors={state.errors} field="whatsapp" />
                                </>
                            ) : (
                                <p className="text-xs text-dashboard-base-content/40">Same as phone number</p>
                            )}
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70">
                                Email
                            </Label>
                            <Input
                                id="email" name="email" type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="rahul@gmail.com"
                                className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content placeholder:text-dashboard-base-content/30 focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary"
                            />
                        </div>
                    </div>

                    {/* ── Package Details ── */}
                    <SectionLabel icon={MapPin} label="Package Details" />

                    <div className="grid grid-cols-2 gap-3">
                        {/* Destination */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70">
                                Destination <span className="text-dashboard-base-content/40">(optional)</span>
                            </Label>
                            <Select
                                value={selectedDestId ? `${selectedDestId}::${selectedDestName}` : ""}
                                onValueChange={handleDestChange}
                                disabled={loadingDests}
                            >
                                <SelectTrigger className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                                    {loadingDests ? (
                                        <span className="flex items-center gap-1.5 text-dashboard-base-content/45 text-sm">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                        </span>
                                    ) : (
                                        <SelectValue placeholder="Select destination (optional)" />
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                                    {destinations.map(d => (
                                        <SelectItem
                                            key={d.id} value={`${d.id}::${d.name}`}
                                            className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 rounded-lg"
                                        >
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                    {!loadingDests && destinations.length === 0 && (
                                        <SelectItem value="__none__" disabled className="text-dashboard-base-content/35 text-sm">
                                            No destinations found
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <FieldError errors={state.errors} field="destination" />
                        </div>

                        {/* Package */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70">
                                Package
                            </Label>
                            <Select
                                value={selectedPkgTitle}
                                onValueChange={setSelectedPkgTitle}
                                disabled={!selectedDestId || loadingPkgs}
                            >
                                <SelectTrigger className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content focus:ring-dashboard-primary/30 focus:border-dashboard-primary disabled:opacity-50">
                                    {loadingPkgs ? (
                                        <span className="flex items-center gap-1.5 text-dashboard-base-content/45 text-sm">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                        </span>
                                    ) : (
                                        <SelectValue placeholder={!selectedDestId ? "Select destination first" : "Select package"} />
                                    )}
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                                    {packages.map(p => (
                                        <SelectItem
                                            key={p.id} value={p.title}
                                            className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 rounded-lg"
                                        >
                                            {p.title}
                                        </SelectItem>
                                    ))}
                                    {!loadingPkgs && selectedDestId && packages.length === 0 && (
                                        <SelectItem value="__none__" disabled className="text-dashboard-base-content/35 text-sm">
                                            No packages for this destination
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Group size */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70 flex items-center gap-1">
                                <Users className="h-3 w-3" /> No. of Travellers
                            </Label>
                            <Input
                                id="groupSize" name="groupSize"
                                type="number" min="1" max="100" placeholder="4"
                                value={groupSize}
                                onChange={(e) => setGroupSize(e.target.value)}
                                className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content placeholder:text-dashboard-base-content/30 focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary"
                            />
                        </div>

                        {/* Travel date */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-dashboard-base-content/70 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Travel Date
                            </Label>
                            <Input
                                id="travelDate" name="travelDate" type="date"
                                value={travelDate}
                                onChange={(e) => setTravelDate(e.target.value)}
                                className="h-9 text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary"
                            />
                        </div>
                    </div>

                    {/* ── Source ── */}
                    <SectionLabel icon={Globe} label="Source" />

                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-dashboard-base-content/70">
                            How did they reach us?
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {SOURCES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setSource(s.value)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150",
                                        source === s.value
                                            ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary shadow-sm"
                                            : "bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content/55 hover:bg-dashboard-base-200 hover:text-dashboard-base-content hover:border-dashboard-base-300"
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <FieldError errors={state.errors} field="source" />
                    </div>

                    {/* ── Notes ── */}
                    <SectionLabel icon={MessageSquare} label="Notes / Message" />

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-dashboard-base-content/70">
                            What did they enquire about?
                        </Label>
                        <Textarea
                            id="message" name="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g. Looking for a 7-day Kashmir honeymoon package in June..."
                            rows={3}
                            className="resize-none text-sm rounded-lg bg-dashboard-base-100 border-dashboard-base-300 text-dashboard-base-content placeholder:text-dashboard-base-content/30 focus-visible:ring-dashboard-primary/30 focus-visible:border-dashboard-primary"
                        />
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-dashboard-base-300">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content hover:bg-dashboard-base-200 hover:text-dashboard-base-content"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="gap-2 rounded-xl bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 disabled:opacity-60"
                        >
                            {isPending
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                                : <><Plus className="h-3.5 w-3.5" /> Save Query</>
                            }
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}