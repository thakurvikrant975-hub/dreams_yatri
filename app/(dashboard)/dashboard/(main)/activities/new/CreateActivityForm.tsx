"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    MapPin, Tag, Search, FileText, ChevronDown, Check,
    Phone, Mail, Building2, Loader2,
} from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch }   from "../../components/ui/switch";
import { Badge }    from "../../components/ui/badge";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { toast }  from "sonner";
import { cn }     from "@/app/lib/utils";
import { LocationPickerField } from "../../components/dashboard/LocationPickerField";
import type { LocationResult } from "../../components/dashboard/LocationSearchInput";
import { createActivity } from "../actions";

// ── Constants ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];
export const CATEGORIES   = [
    "Adventure", "Cultural", "Wildlife", "Water Sports",
    "Trekking", "Sightseeing", "Food & Culinary",
    "Shopping", "Spiritual", "Photography", "Other",
];

type Destination = { id: number; name: string; region: { name: string } };

// ── Destination searchable combobox ───────────────────────────────────────

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
        <PopoverPrimitive.Root open={open} onOpenChange={o => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 50); }}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
                        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        error ? "border-destructive" : "border-input",
                        !selected && "text-muted-foreground",
                    )}
                >
                    <span className="truncate">
                        {selected
                            ? <>{selected.name} <span className="text-muted-foreground text-xs">({selected.region.name})</span></>
                            : "Search destination…"
                        }
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    className="z-50 w-[--radix-popover-trigger-width] rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
                    sideOffset={4}
                    align="start"
                >
                    <div className="flex items-center border-b px-3 py-2 gap-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Search destinations…"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No destinations found</p>
                        ) : filtered.map(d => (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => { onChange(String(d.id)); setOpen(false); setFilter(""); }}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            >
                                <Check className={cn("h-4 w-4 shrink-0", String(d.id) === value ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 text-left">{d.name}</span>
                                <span className="text-xs text-muted-foreground">{d.region.name}</span>
                            </button>
                        ))}
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}

// ── Section card wrapper ──────────────────────────────────────────────────

function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon:         React.ElementType;
    title:        string;
    description?: string;
    children:     React.ReactNode;
}) {
    return (
        <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-3 px-5 py-4 border-b">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
            </div>
            <div className="px-5 py-5 space-y-4">{children}</div>
        </div>
    );
}

// ── Field error ───────────────────────────────────────────────────────────

function FieldError({ errors, field }: { errors: Record<string, string[]>; field: string }) {
    const msgs = errors[field];
    if (!msgs?.length) return null;
    return <p className="text-xs text-destructive mt-1">{msgs[0]}</p>;
}

// ── Main form ─────────────────────────────────────────────────────────────

export function CreateActivityForm({ destinations }: { destinations: Destination[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Basic Info
    const [name,         setName]        = useState("");
    const [slug,         setSlug]        = useState("");
    const [destId,       setDestId]      = useState("");
    const [category,     setCategory]    = useState("");
    const [difficulty,   setDifficulty]  = useState("");
    const [duration,     setDuration]    = useState("");
    const [isActive,     setIsActive]    = useState(true);

    // Location & Contact
    const [location, setLocation] = useState<LocationResult | null>(null);
    const [address,  setAddress]  = useState("");
    const [city,     setCity]     = useState("");
    const [state,    setState]    = useState("");
    const [country,  setCountry]  = useState("India");
    const [pincode,  setPincode]  = useState("");
    const [phone,    setPhone]    = useState("");
    const [email,    setEmail]    = useState("");

    // Content
    const [description, setDescription] = useState("");

    // SEO
    const [metaTitle, setMetaTitle] = useState("");
    const [metaDesc,  setMetaDesc]  = useState("");

    // Errors
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // ── Handlers ─────────────────────────────────────────────────────────

    function handleNameChange(val: string) {
        setName(val);
        setSlug(
            val.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
        );
        if (!metaTitle) setMetaTitle(`${val} | Dreams Yatri`);
    }

    function handleLocationChange(loc: LocationResult | null) {
        setLocation(loc);
        // Auto-fill city/state from location result if fields are empty
        if (loc && !city) {
            const parts = loc.place_name?.split(",").map(s => s.trim()) ?? [];
            if (parts.length >= 2 && !city) setCity(parts[0]);
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

            const result = await createActivity({ success: false, message: "" }, fd);

            if (result.success && result.id) {
                toast.success(result.message);
                router.push(`/dashboard/activities/${result.id}`);
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

                {/* Name + Slug */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Activity Name <span className="text-destructive">*</span></Label>
                        <Input
                            value={name}
                            onChange={e => handleNameChange(e.target.value)}
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

                {/* Destination */}
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

                {/* Category + Difficulty */}
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

                {/* Duration + Active */}
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
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 h-9 px-4 h-auto">
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

                {/* Map pin picker */}
                <div className="space-y-1.5">
                    <Label>Map Location <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <LocationPickerField
                        value={location}
                        onChange={handleLocationChange}
                        placeholder="Search or pin activity location on map…"
                    />
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                    <Label>Street Address</Label>
                    <Input
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="123, Main Road, Near Bus Stand"
                    />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>City</Label>
                        <Input
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            placeholder="Rishikesh"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>State</Label>
                        <Input
                            value={state}
                            onChange={e => setState(e.target.value)}
                            placeholder="Uttarakhand"
                        />
                    </div>
                </div>

                {/* Country + Pincode */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Country</Label>
                        <Input
                            value={country}
                            onChange={e => setCountry(e.target.value)}
                            placeholder="India"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Pincode</Label>
                        <Input
                            value={pincode}
                            onChange={e => setPincode(e.target.value)}
                            placeholder="249201"
                        />
                    </div>
                </div>

                {/* Phone + Email */}
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
            <div className="flex items-center justify-between pt-2 pb-8">
                <Button variant="outline" asChild>
                    <Link href="/dashboard/activities">Cancel</Link>
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={isPending}
                    size="lg"
                    className="gap-2 bg-dashboard-primary text-dashboard-primary-content hover:bg-dashboard-primary/90 min-w-36"
                >
                    {isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                    ) : (
                        "Create Activity"
                    )}
                </Button>
            </div>
        </div>
    );
}
