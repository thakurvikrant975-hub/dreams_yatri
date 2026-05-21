"use client";

import { useState, useTransition, useRef } from "react";
import {
    MapPin, Tag, FileText, ChevronDown, Check,
    Phone, Mail, Loader2, Lock,
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
import { LocationSearchSelect } from "../../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../../components/location/location.types";
import { ACTIVITY_TYPES }    from "../../../components/location/location.types";
import { updateActivity } from "../../actions";

// ── Constants ─────────────────────────────────────────────────────────────

const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];

// ── Types ─────────────────────────────────────────────────────────────────

type CategoryOption = { id: number; name: string; slug: string };

export type ActivityDetail = {
    id:             number;
    name:           string;
    slug:           string;
    description:    string | null;
    category_id:    number | null;
    category:       { id: number; name: string; slug: string } | null;
    difficulty:     string | null;
    duration_hours: number | null;
    location:       LocationValue | null;
    address:        string | null;
    city:           string | null;
    state:          string | null;
    country:        string | null;
    pincode:        string | null;
    phone:          string | null;
    email:          string | null;
    is_active:      boolean;
};

// ── Category searchable combobox ──────────────────────────────────────────

function CategoryCombobox({
    categories,
    value,
    onChange,
    error,
}: {
    categories: CategoryOption[];
    value:      string;
    onChange:   (v: string) => void;
    error?:     string;
}) {
    const [open,   setOpen]   = useState(false);
    const [filter, setFilter] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = categories.find(c => String(c.id) === value);
    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <PopoverPrimitive.Root
            open={open}
            onOpenChange={o => { setOpen(o); if (o) setTimeout(() => inputRef.current?.focus(), 50); }}
        >
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
                    <span className="truncate">{selected ? selected.name : "Search category…"}</span>
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
                            placeholder="Search categories…"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-muted-foreground"
                            onClick={() => { onChange(""); setOpen(false); setFilter(""); }}
                        >
                            <Check className={cn("h-3.5 w-3.5 shrink-0", !value ? "opacity-100" : "opacity-0")} />
                            None
                        </button>
                        {filtered.length === 0
                            ? <p className="py-6 text-center text-sm text-muted-foreground">No categories found</p>
                            : filtered.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                                    onClick={() => { onChange(String(c.id)); setOpen(false); setFilter(""); }}
                                >
                                    <Check className={cn("h-3.5 w-3.5 shrink-0", String(c.id) === value ? "opacity-100" : "opacity-0")} />
                                    <span className="flex-1 text-left">{c.name}</span>
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
    categories,
}: {
    activity:   ActivityDetail;
    categories: CategoryOption[];
}) {
    const [isPending, startTransition] = useTransition();

    // Basic Info
    const [name,       setName]      = useState(activity.name);
    const slug = activity.slug;
    const [categoryId, setCategoryId]= useState(activity.category_id != null ? String(activity.category_id) : "");
    const [difficulty, setDifficulty]= useState(activity.difficulty ?? "");
    const [duration,   setDuration]  = useState(activity.duration_hours != null ? String(activity.duration_hours) : "");
    const [isActive,   setIsActive]  = useState(activity.is_active);

    // Location & Contact
    const [location, setLocation] = useState<LocationValue | null>(activity.location);
    const [address, setAddress] = useState(activity.address ?? "");
    const [city,    setCity]    = useState(activity.city    ?? "");
    const [state,   setState]   = useState(activity.state   ?? "");
    const [country, setCountry] = useState(activity.country ?? "India");
    const [pincode, setPincode] = useState(activity.pincode ?? "");
    const [phone,   setPhone]   = useState(activity.phone   ?? "");
    const [email,   setEmail]   = useState(activity.email   ?? "");

    // Content
    const [description, setDescription] = useState(activity.description ?? "");

    // Errors
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // ── Handlers ──────────────────────────────────────────────────────────

    function handleLocationChange(loc: LocationValue | null) {
        setLocation(loc);
        if (loc) {
            const parts = loc.breadcrumb.split(",").map(s => s.trim());
            const detected = parts.at(-1) ?? "";
            if (detected) setCountry(detected);
        }
    }

    function handleSubmit() {
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.append("name",           name);
            if (categoryId) fd.append("category_id", categoryId);
            fd.append("difficulty",     difficulty);
            fd.append("duration_hours", duration);
            fd.append("is_active",      String(isActive));
            fd.append("location_id",    location?.id ?? "");
            fd.append("address",        address);
            fd.append("city",           city);
            fd.append("state",          state);
            fd.append("country",        country);
            fd.append("pincode",        pincode);
            fd.append("phone",          phone);
            fd.append("email",          email);
            fd.append("description",    description);

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
        <div className="space-y-5">

            {/* ── Section 1: Basic Info ── */}
            <Section icon={Tag} title="Basic Info" description="Name, category and classification">

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
                        <Label className="flex items-center gap-1.5">
                            Slug <Lock className="h-3 w-3 text-muted-foreground" />
                        </Label>
                        <Input
                            value={slug}
                            readOnly
                            disabled
                            className="cursor-not-allowed bg-muted/50 text-muted-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Slug is permanent and cannot be changed after creation</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <CategoryCombobox
                            categories={categories}
                            value={categoryId}
                            onChange={setCategoryId}
                            error={errors.category_id?.[0]}
                        />
                        <FieldError errors={errors} field="category_id" />
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
                    <LocationSearchSelect
                        value={location}
                        onChange={handleLocationChange}
                        placeholder="Search activity location…"
                        types={ACTIVITY_TYPES}
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
                        <Label>Country <span className="text-xs text-muted-foreground">(auto-filled from map)</span></Label>
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
