"use client";

import { Palette, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import {
    FONT_CHOICES, TEMPLATES, resolveDocTheme,
    type FontKey, type ThemeOverrides,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder-v2/[packageId]/doc-theme";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** One colour, editable two ways: the swatch opens the OS picker, the text
 * field accepts a hex pasted from a brand guide. Both write the same value.
 *
 * The text input is intentionally not validated on every keystroke — typing
 * "#ef4444" passes through "#e", "#ef"… and rejecting those mid-word would
 * make the field impossible to type into. Invalid values are simply not
 * committed upward, and the swatch keeps showing the last good colour. */
function ColorField({
    label, hint, value, fallback, onChange, disabled,
}: {
    label: string;
    hint: string;
    value: string | undefined;
    /** What the template supplies when this override is unset — shown in the
     * swatch so the admin sees the real starting colour, not an empty box. */
    fallback: string;
    onChange: (v: string | undefined) => void;
    disabled: boolean;
}) {
    const effective = value && HEX_RE.test(value) ? value : fallback;
    const isOverridden = !!value;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">{label}</Label>
                {isOverridden && !disabled && (
                    <button
                        type="button"
                        onClick={() => onChange(undefined)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RotateCcw className="size-2.5" /> Reset
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    aria-label={label}
                    value={effective}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Input
                    value={value ?? ""}
                    placeholder={fallback}
                    disabled={disabled}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        onChange(v === "" ? undefined : v.toUpperCase());
                    }}
                    className="h-9 font-mono text-xs"
                />
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
        </div>
    );
}

function FontField({
    label, value, fallbackLabel, onChange, disabled,
}: {
    label: string;
    value: FontKey | undefined;
    fallbackLabel: string;
    onChange: (v: FontKey | undefined) => void;
    disabled: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <select
                value={value ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value === "" ? undefined : (e.target.value as FontKey))}
                className="h-9 w-full rounded-md border bg-transparent px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
                <option value="">Template default — {fallbackLabel}</option>
                {FONT_CHOICES.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                ))}
            </select>
        </div>
    );
}

/** Company-wide document appearance: which template every package starts on,
 * and the brand tweaks layered over it.
 *
 * Only a deliberate subset of the palette is exposed — accent, page and ink.
 * Rules, badge grounds and the five note tones stay under the template's
 * control, because they're internal consistency rather than brand, and an
 * admin free to set them individually mostly produces documents that look
 * broken rather than customised. */
export function DocumentThemeCard({
    template, overrides, onTemplateChange, onOverridesChange, readOnly,
}: {
    template: string;
    overrides: ThemeOverrides;
    onTemplateChange: (id: string) => void;
    onOverridesChange: (next: ThemeOverrides) => void;
    readOnly: boolean;
}) {
    // The template's own values, with no overrides applied — what each field
    // falls back to, and what the "Reset" affordances restore.
    const base = resolveDocTheme(template);
    // What a document will actually render as, once the overrides land.
    const preview = resolveDocTheme(template, overrides);

    const templateIds = Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[];

    function set<K extends keyof ThemeOverrides>(key: K, value: ThemeOverrides[K]) {
        const next = { ...overrides };
        if (value === undefined) delete next[key];
        else next[key] = value;
        onOverridesChange(next);
    }

    const fontLabel = (stack: string) =>
        FONT_CHOICES.find((f) => stack.includes(f.key))?.label.split(" — ")[0] ?? "Poppins";

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="size-4" /> Document Theme
                </CardTitle>
                <CardDescription>
                    How every itinerary document and PDF looks. A package can still override this on its own —
                    what you set here is the starting point for all of them.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* ── Template ─────────────────────────────────────────────── */}
                <div className="space-y-2">
                    <Label className="text-xs">Default template</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {templateIds.map((id) => {
                            const t = TEMPLATES[id];
                            const active = template === id;
                            const swatch = resolveDocTheme(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => onTemplateChange(id)}
                                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        active ? "border-primary-500 bg-primary-50/50" : "hover:bg-muted/40"
                                    }`}
                                >
                                    {/* Miniature of the page itself — ground, rule and accent in
                                        the proportions the document uses them. */}
                                    <span
                                        className="mt-0.5 flex size-9 shrink-0 flex-col justify-between rounded-md border p-1"
                                        style={{ backgroundColor: swatch.paper, borderColor: swatch.rule }}
                                    >
                                        <span className="block h-1 w-full rounded-full" style={{ backgroundColor: swatch.ink }} />
                                        <span className="block h-1 w-2/3 rounded-full" style={{ backgroundColor: swatch.inkMuted }} />
                                        <span className="block h-1.5 w-1/2 rounded-full" style={{ backgroundColor: swatch.accent }} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-xs font-semibold">{t.label}</span>
                                        <span className="block text-[10px] text-muted-foreground leading-snug">{t.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Colours ──────────────────────────────────────────────── */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <ColorField
                        label="Accent"
                        hint="Prices, the total-price cell, contact icons."
                        value={overrides.accent}
                        fallback={base.accent}
                        onChange={(v) => set("accent", v)}
                        disabled={readOnly}
                    />
                    <ColorField
                        label="Page"
                        hint="The ground the document is printed on."
                        value={overrides.paper}
                        fallback={base.paper}
                        onChange={(v) => set("paper", v)}
                        disabled={readOnly}
                    />
                    <ColorField
                        label="Text"
                        hint="Headings and body copy."
                        value={overrides.ink}
                        fallback={base.ink}
                        onChange={(v) => set("ink", v)}
                        disabled={readOnly}
                    />
                </div>

                {/* ── Fonts ────────────────────────────────────────────────── */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <FontField
                        label="Heading font"
                        value={overrides.fontHeading}
                        fallbackLabel={fontLabel(base.fontHeading)}
                        onChange={(v) => set("fontHeading", v)}
                        disabled={readOnly}
                    />
                    <FontField
                        label="Body font"
                        value={overrides.fontBody}
                        fallbackLabel={fontLabel(base.fontBody)}
                        onChange={(v) => set("fontBody", v)}
                        disabled={readOnly}
                    />
                </div>

                {/* ── Preview ──────────────────────────────────────────────────
                    Worth the space: an accent picked as a swatch and an accent
                    seen behind a real price are different judgements, and this
                    is the only place to make the second one before the theme
                    reaches a client's PDF. */}
                <div className="space-y-2">
                    <Label className="text-xs">Preview</Label>
                    <div
                        className="rounded-lg border p-4"
                        style={{ backgroundColor: preview.paper, borderColor: preview.rule }}
                    >
                        <div
                            className="flex items-center justify-between border-b pb-2"
                            style={{ borderColor: preview.rule }}
                        >
                            <span
                                className="text-sm font-bold"
                                style={{ color: preview.ink, fontFamily: preview.fontHeading }}
                            >
                                Kashmir — 5 Days
                            </span>
                            <span className="text-[10px]" style={{ color: preview.accent }}>
                                +91 78077 27100
                            </span>
                        </div>
                        <p
                            className="mt-2 text-[11px] leading-relaxed"
                            style={{ color: preview.inkSoft, fontFamily: preview.fontBody }}
                        >
                            Day 1 · Arrive Srinagar, transfer to the houseboat, evening shikara ride on Dal Lake.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                            <span
                                className="rounded-md px-2.5 py-1 text-[11px] font-bold text-white"
                                style={{ backgroundColor: preview.accent, fontFamily: preview.fontHeading }}
                            >
                                INR 48,500
                            </span>
                            <span
                                className="rounded-md px-2 py-1 text-[10px] font-medium"
                                style={{ backgroundColor: preview.accentSoft, color: preview.accentInk }}
                            >
                                Per person
                            </span>
                            <span
                                className="rounded-md px-2 py-1 text-[10px] font-medium"
                                style={{ backgroundColor: preview.iconBadge, color: preview.inkSoft }}
                            >
                                4 Adults
                            </span>
                        </div>
                    </div>
                </div>

                {Object.keys(overrides).length > 0 && !readOnly && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOverridesChange({})}
                        className="gap-1.5"
                    >
                        <RotateCcw className="size-3" /> Reset all to template defaults
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
