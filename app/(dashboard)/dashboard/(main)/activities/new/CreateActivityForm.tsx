"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    MapPin, Tag, FileText, ChevronDown, Check,
    Phone, Mail, Loader2, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { Button }   from "../../components/ui/button";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch }   from "../../components/ui/switch";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../components/ui/select";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { toast }  from "sonner";
import { cn }     from "@/app/lib/utils";
import { LocationSearchSelect } from "../../components/location/LocationSearchSelect";
import type { LocationValue } from "../../components/location/location.types";
import { createActivity, checkActivitySlug } from "../actions";

// ── Constants ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ["Easy", "Moderate", "Challenging", "Difficult", "Expert"];

type CategoryOption = { id: number; name: string; slug: string };

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
                        error ? "border-destructive" : "border-input",
                        !selected && "text-muted-foreground",
                    )}
                >
                    <span className="truncate">{selected ? selected.name : "Search category…"}</span>
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
                        <input
                            ref={inputRef}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Search categories…"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                        <button
                            type="button"
                            onClick={() => { onChange(""); setOpen(false); setFilter(""); }}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                        >
                            <Check className={cn("h-4 w-4 shrink-0", !value ? "opacity-100" : "opacity-0")} />
                            None
                        </button>
                        {filtered.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">No categories found</p>
                        ) : filtered.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => { onChange(String(c.id)); setOpen(false); setFilter(""); }}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            >
                                <Check className={cn("h-4 w-4 shrink-0", String(c.id) === value ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 text-left">{c.name}</span>
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

export function CreateActivityForm({ categories }: { categories: CategoryOption[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Basic Info
    const [name,       setName]      = useState("");
    const [slug,       setSlug]      = useState("");
    const [categoryId, setCategoryId]= useState("");
    const [difficulty, setDifficulty]= useState("");
    const [duration,   setDuration]  = useState("");
    const [isActive,   setIsActive]  = useState(true);

    // Location & Contact
    const [location, setLocation] = useState<LocationValue | null>(null);
    const [phone,    setPhone]    = useState("");
    const [email,    setEmail]    = useState("");

    // Content
    const [description, setDescription] = useState("");

    // Errors
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    // Track fields auto-set by sightseeing detection (so manual edits aren't clobbered)
    const autoCategoryRef   = useRef(false);
    const autoDifficultyRef = useRef(false);
    const autoDurationRef   = useRef(false);

    // Slug check
    type SlugStatus = "idle" | "checking" | "available" | "active_taken" | "inactive_exists";
    const [slugStatus,     setSlugStatus]     = useState<SlugStatus>("idle");
    const [slugSuggestion, setSlugSuggestion] = useState("");

    useEffect(() => {
        if (!slug || slug.length < 3) { setSlugStatus("idle"); return; }
        setSlugStatus("checking");
        const t = setTimeout(async () => {
            const res = await checkActivitySlug(slug);
            setSlugStatus(res.status);
            setSlugSuggestion(res.suggestion ?? "");
        }, 500);
        return () => clearTimeout(t);
    }, [slug]);

    // ── Handlers ─────────────────────────────────────────────────────────

    function handleNameChange(raw: string) {
        const val = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;

        setName(val);
        setSlug(
            val.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
        );

        // Auto-fill fields when "sightseeing" is present in the name
        const hasSightseeing = /sightseeing/i.test(val);
        const sightseeingCat = categories.find(c => c.name.toLowerCase() === "sightseeing");

        if (hasSightseeing) {
            if (sightseeingCat) { setCategoryId(String(sightseeingCat.id)); autoCategoryRef.current = true; }
            if (!autoDifficultyRef.current || difficulty === "") { setDifficulty("Easy"); autoDifficultyRef.current = true; }
            if (!autoDurationRef.current  || duration  === "") { setDuration("2");    autoDurationRef.current  = true; }
        } else {
            if (autoCategoryRef.current)   { setCategoryId("");  autoCategoryRef.current   = false; }
            if (autoDifficultyRef.current) { setDifficulty(""); autoDifficultyRef.current = false; }
            if (autoDurationRef.current)   { setDuration("");   autoDurationRef.current   = false; }
        }
    }

    function handleLocationChange(loc: LocationValue | null) {
        setLocation(loc);
    }

    function handleSubmit() {
        if (!description.trim()) {
            setErrors({ description: ["Description is required"] });
            document.getElementById("activity-description")?.focus();
            return;
        }
        setErrors({});
        startTransition(async () => {
            const fd = new FormData();
            fd.append("name",           name);
            fd.append("slug",           slug);
            if (categoryId) fd.append("category_id", categoryId);
            fd.append("difficulty",     difficulty);
            fd.append("duration_hours", duration);
            fd.append("is_active",      String(isActive));
            fd.append("location_id",    location?.id ?? "");
            fd.append("phone",          phone);
            fd.append("email",          email);
            fd.append("description",    description);

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
        <div className="space-y-5">

            {/* ── Section 1: Basic Info ── */}
            <Section icon={Tag} title="Basic Info" description="Name, category and classification">

                {/* Name + Slug */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label>Activity Name <span className="text-destructive">*</span></Label>
                            <span className={cn("text-xs", name.length > 80 ? "text-destructive" : "text-muted-foreground")}>
                                {name.length}/90
                            </span>
                        </div>
                        <Input
                            value={name}
                            onChange={e => handleNameChange(e.target.value.slice(0, 90))}
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
                            className={cn(
                                slugStatus === "active_taken"    && "border-destructive",
                                slugStatus === "inactive_exists" && "border-yellow-500",
                                slugStatus === "available"       && "border-green-500",
                            )}
                        />
                        {/* Slug status indicator */}
                        {slugStatus === "checking" && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                            </p>
                        )}
                        {slugStatus === "available" && (
                            <p className="flex items-center gap-1.5 text-xs text-green-600">
                                <CheckCircle2 className="h-3 w-3" /> Available
                            </p>
                        )}
                        {slugStatus === "active_taken" && (
                            <p className="flex items-center gap-1.5 text-xs text-destructive">
                                <XCircle className="h-3 w-3" />
                                Already taken.{slugSuggestion && (
                                    <> Try:{" "}
                                        <button
                                            type="button"
                                            className="underline font-medium"
                                            onClick={() => setSlug(slugSuggestion)}
                                        >
                                            {slugSuggestion}
                                        </button>
                                    </>
                                )}
                            </p>
                        )}
                        {slugStatus === "inactive_exists" && (
                            <p className="flex items-center gap-1.5 text-xs text-yellow-600">
                                <AlertCircle className="h-3 w-3" /> Inactive record exists — submitting will update it
                            </p>
                        )}
                        {slugStatus === "idle" && <FieldError errors={errors} field="slug" />}
                    </div>
                </div>

                {/* Category + Difficulty */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <CategoryCombobox
                            categories={categories}
                            value={categoryId}
                            onChange={v => { autoCategoryRef.current = false; setCategoryId(v); }}
                            error={errors.category_id?.[0]}
                        />
                        <FieldError errors={errors} field="category_id" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Difficulty</Label>
                        <Select value={difficulty} onValueChange={v => { autoDifficultyRef.current = false; setDifficulty(v); }}>
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
                            onChange={e => { autoDurationRef.current = false; setDuration(e.target.value); }}
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 px-4 h-auto">
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

                {/* Map location */}
                <div className="space-y-1.5">
                    <Label>Map Location <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <LocationSearchSelect
                        value={location}
                        onChange={handleLocationChange}
                        placeholder="Search sightseeing location…"
                        types={["ACTIVITY"]}
                        lockedType="ACTIVITY"
                    />
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
                        <Label htmlFor="activity-description">
                            Description <span className="text-destructive">*</span>
                        </Label>
                        <span className={cn("text-xs", description.length > 4800 ? "text-destructive" : "text-muted-foreground")}>
                            {description.length}/5000
                        </span>
                    </div>
                    <Textarea
                        id="activity-description"
                        placeholder="A brief description of this activity…"
                        value={description}
                        onChange={e => {
                            if (e.target.value.length <= 5000) {
                                setDescription(e.target.value);
                                if (errors.description) setErrors(prev => ({ ...prev, description: [] }));
                            }
                        }}
                        rows={6}
                        className={cn(errors.description && "border-destructive focus-visible:ring-destructive")}
                    />
                    <FieldError errors={errors} field="description" />
                </div>
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
