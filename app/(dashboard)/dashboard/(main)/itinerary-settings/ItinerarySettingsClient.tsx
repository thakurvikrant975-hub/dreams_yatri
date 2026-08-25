"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, Save, ShieldAlert, Trash2, X, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { updateItinerarySettings, type ItinerarySettings, type PolicySection } from "./actions";
import { DocumentThemeCard } from "./DocumentThemeCard";
import type { ThemeOverrides } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/doc-theme";

type FormState = {
    companyPhone: string;
    companyEmail: string;
    companyAddress: string;
    companyDescription: string;
    documentDisclaimer: string;
    inclusions: string[];
    exclusions: string[];
    termsConditions: string[];
    paymentPolicy: string[];
    amendmentPolicy: string[];
    travelBenefits: string[];
    customPolicySections: PolicySection[];
    defaultMarginPercentage: string;
    defaultGstPercentage: string;
    defaultTemplate: string;
    themeOverrides: ThemeOverrides;
};

function newSectionId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `section-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function EditableList({
    label, items, onChange, placeholder, readOnly,
}: {
    label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string; readOnly: boolean;
}) {
    const [input, setInput] = useState("");
    function add() {
        const val = input.trim();
        if (val && !items.includes(val)) { onChange([...items, val]); setInput(""); }
    }
    return (
        <div>
            <Label className="mb-2">{label}</Label>
            {!readOnly && (
                <div className="flex gap-2 mb-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                        placeholder={placeholder ?? "Add item…"}
                        className="text-sm h-9 flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={add} className="h-9 px-3">
                        <Plus size={16} />
                    </Button>
                </div>
            )}
            <div className="flex flex-wrap gap-1.5">
                {items.length === 0 && <p className="text-xs text-muted-foreground italic">Nothing added yet.</p>}
                {items.map((item, i) => (
                    <span
                        key={i}
                        className="flex items-center gap-1 text-xs bg-muted text-foreground px-2.5 py-1 rounded-full border"
                    >
                        {item}
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => onChange(items.filter((_, j) => j !== i))}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                            >
                                <X size={11} />
                            </button>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function ItinerarySettingsClient({
    settings, readOnly,
}: {
    settings: ItinerarySettings;
    readOnly: boolean;
}) {
    const [form, setForm] = useState<FormState>({
        companyPhone: settings.companyPhone,
        companyEmail: settings.companyEmail,
        companyAddress: settings.companyAddress,
        companyDescription: settings.companyDescription,
        documentDisclaimer: settings.documentDisclaimer,
        inclusions: settings.inclusions,
        exclusions: settings.exclusions,
        termsConditions: settings.termsConditions,
        paymentPolicy: settings.paymentPolicy,
        amendmentPolicy: settings.amendmentPolicy,
        travelBenefits: settings.travelBenefits,
        customPolicySections: settings.customPolicySections,
        defaultMarginPercentage: String(settings.defaultMarginPercentage),
        defaultGstPercentage: String(settings.defaultGstPercentage),
        defaultTemplate: settings.defaultTemplate,
        themeOverrides: settings.themeOverrides,
    });
    const [isPending, startTransition] = useTransition();

    function save() {
        startTransition(async () => {
            const result = await updateItinerarySettings({
                ...form,
                defaultMarginPercentage: parseFloat(form.defaultMarginPercentage) || 0,
                defaultGstPercentage: parseFloat(form.defaultGstPercentage) || 0,
            });
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    function addSection() {
        setForm((f) => ({
            ...f,
            customPolicySections: [...f.customPolicySections, { id: newSectionId(), title: "", items: [] }],
        }));
    }
    function updateSectionTitle(id: string, title: string) {
        setForm((f) => ({
            ...f,
            customPolicySections: f.customPolicySections.map((s) => (s.id === id ? { ...s, title } : s)),
        }));
    }
    function updateSectionItems(id: string, items: string[]) {
        setForm((f) => ({
            ...f,
            customPolicySections: f.customPolicySections.map((s) => (s.id === id ? { ...s, items } : s)),
        }));
    }
    function removeSection(id: string) {
        setForm((f) => ({
            ...f,
            customPolicySections: f.customPolicySections.filter((s) => s.id !== id),
        }));
    }

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Itinerary Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader
                title="Itinerary Settings"
                description="Company header/footer details and the standard policies shown on every sent itinerary"
                icon={NotebookPen}
                actions={
                    !readOnly && (
                        <Button onClick={save} disabled={isPending} className="gap-2 bg-dashboard-primary text-white hover:bg-dashboard-primary/90">
                            <Save size={15} />
                            {isPending ? "Saving…" : "Save Changes"}
                        </Button>
                    )
                }
            />

            {readOnly && (
                <div className="flex items-center gap-2 rounded-lg border border-dashboard-warning/30 bg-dashboard-warning/10 px-4 py-3 text-sm text-dashboard-warning-content">
                    <ShieldAlert size={16} className="shrink-0" />
                    Sales Executives can view this page but only an admin can make changes here.
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {readOnly && <Lock size={14} className="text-muted-foreground" />}
                        Header & Footer
                    </CardTitle>
                    <CardDescription>Shown at the top and bottom of every itinerary document and PDF</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="companyPhone" className="mb-2">Helpline Phone</Label>
                            <Input
                                id="companyPhone"
                                value={form.companyPhone}
                                disabled={readOnly}
                                onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="companyEmail" className="mb-2">Email</Label>
                            <Input
                                id="companyEmail"
                                value={form.companyEmail}
                                disabled={readOnly}
                                onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="companyAddress" className="mb-2">Head Office Address</Label>
                        <Input
                            id="companyAddress"
                            value={form.companyAddress}
                            disabled={readOnly}
                            onChange={(e) => setForm((f) => ({ ...f, companyAddress: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="companyDescription" className="mb-2">Footer Description</Label>
                        <Textarea
                            id="companyDescription"
                            rows={3}
                            value={form.companyDescription}
                            disabled={readOnly}
                            onChange={(e) => setForm((f) => ({ ...f, companyDescription: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor="documentDisclaimer" className="mb-2">Disclaimer Line</Label>
                        <Input
                            id="documentDisclaimer"
                            value={form.documentDisclaimer}
                            disabled={readOnly}
                            onChange={(e) => setForm((f) => ({ ...f, documentDisclaimer: e.target.value }))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {readOnly && <Lock size={14} className="text-muted-foreground" />}
                        Pricing Defaults
                    </CardTitle>
                    <CardDescription>
                        Starting Margin % and GST % for a brand-new package in the builder — still editable per
                        package afterward on its Pricing tab.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="defaultMarginPercentage" className="mb-2">Default Margin %</Label>
                            <Input
                                id="defaultMarginPercentage"
                                type="number"
                                min={0}
                                max={100}
                                value={form.defaultMarginPercentage}
                                disabled={readOnly}
                                onChange={(e) => setForm((f) => ({ ...f, defaultMarginPercentage: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="defaultGstPercentage" className="mb-2">Default GST %</Label>
                            <Input
                                id="defaultGstPercentage"
                                type="number"
                                min={0}
                                max={100}
                                value={form.defaultGstPercentage}
                                disabled={readOnly}
                                onChange={(e) => setForm((f) => ({ ...f, defaultGstPercentage: e.target.value }))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <DocumentThemeCard
                template={form.defaultTemplate}
                overrides={form.themeOverrides}
                onTemplateChange={(defaultTemplate) => setForm((f) => ({ ...f, defaultTemplate }))}
                onOverridesChange={(themeOverrides) => setForm((f) => ({ ...f, themeOverrides }))}
                readOnly={readOnly}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {readOnly && <Lock size={14} className="text-muted-foreground" />}
                        Standard Policies
                    </CardTitle>
                    <CardDescription>
                        Applied to every itinerary company-wide — Sales Executives can see these in the package
                        builder but can&apos;t change them there.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <EditableList
                        label="Inclusions"
                        items={form.inclusions}
                        onChange={(v) => setForm((f) => ({ ...f, inclusions: v }))}
                        placeholder="Add an inclusion…"
                        readOnly={readOnly}
                    />
                    <EditableList
                        label="Exclusions"
                        items={form.exclusions}
                        onChange={(v) => setForm((f) => ({ ...f, exclusions: v }))}
                        placeholder="Add an exclusion…"
                        readOnly={readOnly}
                    />
                    <EditableList
                        label="Terms & Conditions"
                        items={form.termsConditions}
                        onChange={(v) => setForm((f) => ({ ...f, termsConditions: v }))}
                        placeholder="Add a term…"
                        readOnly={readOnly}
                    />
                    <EditableList
                        label="Payment Policy"
                        items={form.paymentPolicy}
                        onChange={(v) => setForm((f) => ({ ...f, paymentPolicy: v }))}
                        placeholder="Add a payment rule…"
                        readOnly={readOnly}
                    />
                    <EditableList
                        label="Amendment Policy"
                        items={form.amendmentPolicy}
                        onChange={(v) => setForm((f) => ({ ...f, amendmentPolicy: v }))}
                        placeholder="Add an amendment rule…"
                        readOnly={readOnly}
                    />
                    <EditableList
                        label="Why Book With Us"
                        items={form.travelBenefits}
                        onChange={(v) => setForm((f) => ({ ...f, travelBenefits: v }))}
                        placeholder="Add a benefit…"
                        readOnly={readOnly}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {readOnly && <Lock size={14} className="text-muted-foreground" />}
                        Custom Policy Sections
                    </CardTitle>
                    <CardDescription>
                        Add your own titled policy blocks (e.g. Visa Policy, Insurance) beyond the standard ones above —
                        shown on every itinerary in the order added.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {form.customPolicySections.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No custom sections yet.</p>
                    )}
                    {form.customPolicySections.map((section) => (
                        <div key={section.id} className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={section.title}
                                    disabled={readOnly}
                                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                    placeholder="Section title (e.g. Visa Policy)"
                                    className="font-semibold flex-1"
                                />
                                {!readOnly && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => removeSection(section.id)}
                                        className="shrink-0 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                            <EditableList
                                label="Points"
                                items={section.items}
                                onChange={(v) => updateSectionItems(section.id, v)}
                                placeholder="Add a point…"
                                readOnly={readOnly}
                            />
                        </div>
                    ))}
                    {!readOnly && (
                        <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-1.5">
                            <Plus size={14} /> Add Section
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
