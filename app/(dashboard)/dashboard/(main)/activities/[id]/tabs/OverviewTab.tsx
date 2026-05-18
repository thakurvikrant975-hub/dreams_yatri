"use client";

import { useState, useTransition, useRef } from "react";
import {
    MapPin, Tag, Search, FileText, ChevronDown, Check,
    Phone, Mail, Loader2,
} from "lucide-react";
import { Button }   from "../../../components/ui/button";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Switch }   from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { toast }  from "sonner";
import { cn }     from "@/app/lib/utils";
import { LocationPickerField } from "../../../components/dashboard/LocationPickerField";
import type { LocationResult } from "../../../components/dashboard/LocationSearchInput";
import { updateActivity } from "../../actions";

// ── Constants ─────────────────────────────────────────────────────────────

const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];
const CATEGORIES   = [
    "Adventure", "Cultural", "Wildlife", "Water Sports",
    "Trekking", "Sightseeing", "Food & Culinary",
    "Shopping", "Spiritual", "Photography", "Other",
];

// ── Types ─────────────────────────────────────────────────────────────────

type Destination = { id: number; name: string; region: { name: string } };

export type ActivityDetail = {
    id:             number;
    name:           string;
    slug:           string;
    description:    string | null;
    meta_title:     string | null;
    meta_desc:      string | null;
    category:       string | null;
    difficulty:     string | null;
    duration_hours: number | null;
    latitude:       number | null;
    longitude:      number | null;
    address:        string | null;
    city:           string | null;
    state:          string | null;
    country:        string | null;
    pincode:        string | null;
    phone:          string | null;
    email:          string | null;
    is_active:      boolean;
    destination:    { id: number; name: string };
};

// ── Destination searchable combobox ────────────────────────────────────────

function DestinationCombobox({
    destinations,
    value,
    onChange,
    error,
}: {
    destinations: Destination[];
    value:        string;
    onChange:     (v: string) => void;
    error?:       string;
}) {
    const [open,   setOpen]   = useState(false);
    const [filter, setFilter] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = destinations.find(d => String(d.id) === value);
    const filtered = destinations.filter(d =>
        d.name.toLowerCase().includes(filter.toLowerCase()) ||
        d.region.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={v => { setOpen(v); if (v) setTimeout(() => inputRef.current?.focus(), 50); }}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        error && "border-destructive",
                        !selected && "text-muted-foreground",
                    )}
                >
                    <span className="truncate">
                        {selected ? `${selected.name} — ${selected.region.name}` : "Select destination…"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover p-1 shadow-md"
                    sideOffset={4}
                >
                    <div className="px-2 pb-1">
                        <input
                            ref={inputRef}
                            className="w-full rounded border-0 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="Search destinations…"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0
                            ? <p className="py-6 text-center text-sm text-muted-foreground">No destinations found</p>
                            : filtered.map(d => (
                                <button
                                    key={d.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => { onChange(String(d.id)); setOpen(false); setFilter(""); }}
                                >
                                    <Check className={cn("h-3.5 w-3.5 shrink-0", String(d.id) === value ? "opacity-100" : "opacity-0")} />
                                    <span className="flex-1 text-left">{d.name}</span>
                                    <span className="text-xs text-muted-foreground">{d.region.name}</span>
                                </button>
                            ))
                        }
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}

// ── Section card ──────────────────────────────────────────────────────────

function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon:        React.ElementType;
    title:       string;
    description: string;
    children:    React.ReactNode;
}) {
    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {title}
                </CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    );
}

// ── Field error ───────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors: Record<string, string[]>; field: string }) {
    const msgs = errors[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-0.5">{msgs[0]}</p>;
}

// ── Overview / Edit Tab ────────────────────────────────────────────────────

export function OverviewTab({
    activity,
    destinations,
}: {
    activity:     ActivityDetail;
    destinations: Destination[];
}) {
    const [isPending, startTransition] = useTransition();

    // Basic Info
    const [name,       setName]      = useState(activity.name);
    const [slug,       setSlug]      = useState(activity.slug);
    const [destId,     setDestId]    = useState(String(activity.destination.id));
    const [category,   setCategory]  = useState(activity.category ?? "");
    const [difficulty, setDifficulty]= useState(activity.difficulty ?? "");
    const [duration,   setDuration]  = useState(activity.duration_hours != null ? String(activity.duration_hours) : "");
    const [isActive,   setIsActive]  = useState(activity.is_active);

    // Location & Contact
    const [location, setLocation] = useState<LocationResult | null>(
        activity.latitude != null && activity.longitude != null
            ? {
                latitude:   activity.latitude,
                longitude:  activity.longitude,
                place_name: `${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}`,
                place_id:   "",
                address:    `${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}`,
            }
            : null
    );
    const [address, setAddress] = useState(activity.address ?? "");
    const [city,    setCity]    = useState(activity.city    ?? "");
    const [state,   setState]   = useState(activity.state   ?? "");
    const [country, setCountry] = useState(activity.country ?? "India");
    const [pincode, setPincode] = useState(activity.pincode ?? "");
    const [phone,   setPhone]   = useState(activity.phone   ?? "");
    const [email,   setEmail]   = useState(activity.email   ?? "");

    // Content
    const [description, setDescription] = useState(activity.description ?? "");

    // SEO
    const [metaTitle, setMetaTitle] = useState(activity.meta_title ?? "");
    const [metaDesc,  setMetaDesc]  = useState(activity.meta_desc  ?? "");

    // Errors
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // ── Handlers ──────────────────────────────────────────────────────────

    function handleLocationChange(loc: LocationResult | null) {
        setLocation(loc);
        if (loc && !city) {
            const parts = loc.place_name?.split(",").map(s => s.trim()) ?? [];
            if (parts.length >= 2) setCity(parts[0]);
        }
    }

    function handleSubmit() {
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.append("name",           name);
            fd.append("slug",           slug);
            fd.append("destination_id", destId);
            fd.append("category",       category);
            fd.append("difficulty",     difficulty);
            fd.append("duration_hours", duration);
            fd.append("is_active",      String(isActive));
            fd.append("latitude",       location?.latitude  != null ? String(location.latitude)  : "");
            fd.append("longitude",      location?.longitude != null ? String(location.longitude) : "");
            fd.append("address",        address);
            fd.append("city",           city);
            fd.append("state",          state);
            fd.append("country",        country);
            fd.append("pincode",        pincode);
            fd.append("phone",          phone);
            fd.append("email",          email);
            fd.append("description",    description);
            fd.append("meta_title",     metaTitle);
            fd.append("meta_desc",      metaDesc);

            const result = await updateActivity(activity.id, { success: false, message: "" }, fd);

            if (result.success) {
                toast.success(result.message);
            } else {
                if (result.errors) setErrors(result.errors);
                toast.error(result.message);
            }
        });
    }

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="max-w-3xl space-y-5">

            {/* ── Section 1: Basic Info ── */}
            <Section icon={Tag} title="Basic Info" description="Name, destination and classification">

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Activity Name <span className="text-destructive">*</span></Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Valley of Flowers Trek"
                            autoComplete="off"
                        />
                        <FieldError errors={errors} field="name" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Slug <span className="text-destructive">*</span></Label>
                        <Input
                            value={slug}
                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                            placeholder="valley-of-flowers-trek"
                        />
                        <FieldError errors={errors} field="slug" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Destination <span className="text-destructive">*</span></Label>
                    <DestinationCombobox
                        destinations={destinations}
                        value={destId}
                        onChange={setDestId}
                        error={errors.destination_id?.[0]}
                    />
                    <FieldError errors={errors} field="destination_id" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Difficulty</Label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                            <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                            <SelectContent>
                                {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                        <Label>Duration (hours)</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="4.5"
                            value={duration}
                            onChange={e => setDuration(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 px-4">
                        <div>
                            <p className="text-sm font-medium">Active</p>
                            <p className="text-xs text-muted-foreground">Visible on Dreams Yatri</p>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                </div>
            </Section>

            {/* ── Section 2: Location & Contact ── */}
            <Section icon={MapPin} title="Location & Contact" description="Physical address, coordinates and business contact">

                <div className="space-y-1.5">
                    <Label>Map Location <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <LocationPickerField
                        value={location}
                        onChange={handleLocationChange}
                        placeholder="Search or pin activity location on map…"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label>Street Address</Label>
                    <Input
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="123, Main Road, Near Bus Stand"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Rishikesh" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>State</Label>
                        <Input value={state} onChange={e => setState(e.target.value)} placeholder="Uttarakhand" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Country</Label>
                        <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="India" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Pincode</Label>
                        <Input value={pincode} onChange={e => setPincode(e.target.value)} placeholder="249201" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Business Phone</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                type="tel"
                            />
                        </div>
                        <FieldError errors={errors} field="phone" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Business Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="contact@activity.com"
                                type="email"
                            />
                        </div>
                        <FieldError errors={errors} field="email" />
                    </div>
                </div>
            </Section>

            {/* ── Section 3: Description ── */}
            <Section icon={FileText} title="Description" description="Overview shown on the activity page">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label>Description</Label>
                        <span className={cn("text-xs", description.length > 4800 ? "text-destructive" : "text-muted-foreground")}>
                            {description.length}/5000
                        </span>
                    </div>
                    <Textarea
                        placeholder="A brief description of this activity…"
                        value={description}
                        onChange={e => setDescription(e.target.value.slice(0, 5000))}
                        rows={6}
                    />
                </div>
            </Section>

            {/* ── Section 4: SEO ── */}
            <Section icon={Search} title="SEO" description="Search engine meta tags — optional but recommended">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label>Meta Title</Label>
                        <span className={cn("text-xs", metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground")}>
                            {metaTitle.length}/60
                        </span>
                    </div>
                    <Input
                        placeholder="Valley of Flowers Trek | Dreams Yatri"
                        value={metaTitle}
                        onChange={e => setMetaTitle(e.target.value.slice(0, 60))}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label>Meta Description</Label>
                        <span className={cn("text-xs", metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground")}>
                            {metaDesc.length}/160
                        </span>
                    </div>
                    <Textarea
                        placeholder="A breathtaking high-altitude trek through a valley of wildflowers…"
                        value={metaDesc}
                        onChange={e => setMetaDesc(e.target.value.slice(0, 160))}
                        rows={3}
                    />
                </div>

                {(metaTitle || metaDesc) && (
                    <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
                            Search Preview
                        </p>
                        <p className="text-xs text-green-700">dreamsyatri.com/activities/{slug || "…"}</p>
                        <p className="text-sm text-blue-600 font-medium">{metaTitle || "Page title"}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{metaDesc || "Page description…"}</p>
                    </div>
                )}
            </Section>

            {/* ── Footer ── */}
            <div className="flex justify-end pt-2 pb-8">
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending}
                    size="lg"
                    className="gap-2 min-w-36"
                >
                    {isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                        "Save Changes"
                    )}
                </Button>
            </div>
        </div>
    );
}
