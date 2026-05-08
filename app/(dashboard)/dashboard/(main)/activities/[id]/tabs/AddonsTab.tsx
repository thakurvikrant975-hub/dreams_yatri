"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Check, X, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";
import { createAddon, updateAddon, deleteAddon, type ActivityAddon } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type AddonFormState = {
    title: string;
    description: string;
    pricing_type: string;
    price: string;
    cost_price: string;
    is_optional: boolean;
    is_active: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────

const ADDON_PRICING_TYPES = [
    { value: "PER_PERSON", label: "Per Person" },
    { value: "FLAT_RATE",  label: "Flat Rate" },
];

const EMPTY_FORM: AddonFormState = {
    title: "",
    description: "",
    pricing_type: "PER_PERSON",
    price: "",
    cost_price: "",
    is_optional: true,
    is_active: true,
};

// ── Addon Form ────────────────────────────────────────────────────────────

function AddonForm({
    initial,
    onSave,
    onCancel,
    isSaving,
}: {
    initial: AddonFormState;
    onSave: (form: AddonFormState) => void;
    onCancel: () => void;
    isSaving: boolean;
}) {
    const [form, setForm] = useState<AddonFormState>(initial);
    function update<K extends keyof AddonFormState>(key: K, value: AddonFormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    const isValid = !!form.title && !!form.pricing_type && !!form.price && Number(form.price) >= 0;

    return (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5 col-span-2">
                    <Label>Title <span className="text-destructive">*</span></Label>
                    <Input
                        placeholder="e.g. Underwater Photography, Lunch Box"
                        value={form.title}
                        onChange={e => update("title", e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Pricing Type <span className="text-destructive">*</span></Label>
                    <Select value={form.pricing_type} onValueChange={v => update("pricing_type", v)}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                            {ADDON_PRICING_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Price (₹) <span className="text-destructive">*</span></Label>
                    <Input
                        type="number" min={0} placeholder="500"
                        value={form.price}
                        onChange={e => update("price", e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Description / Notes</Label>
                    <Input
                        placeholder="Brief note about this add-on"
                        value={form.description}
                        onChange={e => update("description", e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Cost Price (₹)</Label>
                    <Input
                        type="number" min={0} placeholder="300"
                        value={form.cost_price}
                        onChange={e => update("cost_price", e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Switch checked={form.is_optional} onCheckedChange={v => update("is_optional", v)} />
                        <span className="text-sm text-muted-foreground">Optional</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} />
                        <span className="text-sm text-muted-foreground">Active</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button type="button" size="sm" disabled={!isValid || isSaving} onClick={() => onSave(form)}>
                        {isSaving
                            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
                            : <><Check className="mr-1.5 h-3.5 w-3.5" />Save Add-on</>
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────

export function AddonsTab({
    activity_id,
    initialAddons,
}: {
    activity_id: number;
    initialAddons: ActivityAddon[];
}) {
    const [addons, setAddons] = useState<ActivityAddon[]>(initialAddons);
    const [adding, setAdding] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleAdd(form: AddonFormState) {
        startTransition(async () => {
            const res = await createAddon(activity_id, {
                title: form.title,
                description: form.description || null,
                pricing_type: form.pricing_type,
                price: Number(form.price),
                cost_price: form.cost_price ? Number(form.cost_price) : null,
                is_optional: form.is_optional,
                is_active: form.is_active,
            });
            if (res.success) {
                toast.success(res.message);
                setAdding(false);
                setAddons(prev => [...prev, {
                    id: Date.now(),
                    activity_id,
                    title: form.title,
                    description: form.description || null,
                    pricing_type: form.pricing_type,
                    price: Number(form.price),
                    cost_price: form.cost_price ? Number(form.cost_price) : null,
                    is_optional: form.is_optional,
                    is_active: form.is_active,
                    sort_order: prev.length,
                }]);
            } else {
                toast.error(res.message);
            }
        });
    }

    function handleEdit(id: number, form: AddonFormState) {
        startTransition(async () => {
            const res = await updateAddon(id, activity_id, {
                title: form.title,
                description: form.description || null,
                pricing_type: form.pricing_type,
                price: Number(form.price),
                cost_price: form.cost_price ? Number(form.cost_price) : null,
                is_optional: form.is_optional,
                is_active: form.is_active,
            });
            if (res.success) {
                toast.success(res.message);
                setEditId(null);
                setAddons(prev => prev.map(a => a.id === id ? {
                    ...a,
                    title: form.title,
                    description: form.description || null,
                    pricing_type: form.pricing_type,
                    price: Number(form.price),
                    cost_price: form.cost_price ? Number(form.cost_price) : null,
                    is_optional: form.is_optional,
                    is_active: form.is_active,
                } : a));
            } else {
                toast.error(res.message);
            }
        });
    }

    function handleDelete(id: number) {
        startTransition(async () => {
            const res = await deleteAddon(id, activity_id);
            if (res.success) {
                toast.success(res.message);
                setAddons(prev => prev.filter(a => a.id !== id));
            } else {
                toast.error(res.message);
            }
        });
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Package className="h-4 w-4" /> Add-ons
                        </CardTitle>
                        <CardDescription>
                            Optional or mandatory extras that guests can include with this activity.
                        </CardDescription>
                    </div>
                    {!adding && editId === null && (
                        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Add-on
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {adding && (
                    <AddonForm
                        initial={EMPTY_FORM}
                        onSave={handleAdd}
                        onCancel={() => setAdding(false)}
                        isSaving={isPending}
                    />
                )}

                {addons.length > 0 ? (
                    <div className="space-y-2">
                        {addons.map(addon =>
                            editId === addon.id ? (
                                <AddonForm
                                    key={addon.id}
                                    initial={{
                                        title: addon.title,
                                        description: addon.description ?? "",
                                        pricing_type: addon.pricing_type,
                                        price: String(addon.price),
                                        cost_price: addon.cost_price ? String(addon.cost_price) : "",
                                        is_optional: addon.is_optional,
                                        is_active: addon.is_active,
                                    }}
                                    onSave={form => handleEdit(addon.id, form)}
                                    onCancel={() => setEditId(null)}
                                    isSaving={isPending}
                                />
                            ) : (
                                <div
                                    key={addon.id}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                                        !addon.is_active && "opacity-50"
                                    )}
                                >
                                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium">{addon.title}</span>
                                            <Badge
                                                variant={addon.is_optional ? "outline" : "secondary"}
                                                className="text-[10px] px-1.5 py-0"
                                            >
                                                {addon.is_optional ? "Optional" : "Required"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                ₹{addon.price.toLocaleString()}
                                                <span className="ml-1 opacity-60">{addon.pricing_type === "PER_PERSON" ? "/person" : "/group"}</span>
                                            </span>
                                        </div>
                                        {addon.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            type="button" variant="ghost" size="icon" className="h-7 w-7"
                                            onClick={() => setEditId(addon.id)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    type="button" variant="ghost" size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Add-on</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Delete <span className="font-semibold">{addon.title}</span>? This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(addon.id)}
                                                        className="bg-destructive text-white hover:bg-destructive/90"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                ) : !adding && (
                    <div className="text-center py-10 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No add-ons defined</p>
                        <p className="text-xs mt-1">Add optional or required extras like photography, meals, or equipment</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
