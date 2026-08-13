"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

/**
 * The small pieces the invoice and voucher forms are both built from.
 *
 * Both forms are long — a voucher can run to a dozen days, each with its own
 * activities — so the repeated bits (a labelled field, a removable row, a list
 * of plain strings) live here rather than being written out twice with slightly
 * different spacing in each.
 */

export function Field({
    label,
    hint,
    error,
    children,
    className = "",
}: {
    label: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <Label className="text-xs font-medium text-dashboard-base-content/80">{label}</Label>
            {children}
            {error ? (
                <p className="text-[11px] text-dashboard-error">{error}</p>
            ) : hint ? (
                <p className="text-[11px] text-dashboard-base-content/50">{hint}</p>
            ) : null}
        </div>
    );
}

/** A bordered group with a heading and an "add" control — one stay, one day,
 *  one line item. */
export function RepeatableSection({
    title,
    description,
    addLabel,
    onAdd,
    children,
}: {
    title: string;
    description?: string;
    addLabel: string;
    onAdd: () => void;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100">
            <header className="flex items-start justify-between gap-4 border-b border-dashboard-base-content/10 px-4 py-3">
                <div>
                    <h3 className="text-sm font-semibold text-dashboard-base-content">{title}</h3>
                    {description && <p className="mt-0.5 text-[11px] text-dashboard-base-content/50">{description}</p>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAdd}>
                    <Plus /> {addLabel}
                </Button>
            </header>
            <div className="space-y-3 p-4">{children}</div>
        </section>
    );
}

/** One removable entry inside a RepeatableSection. */
export function RepeatableRow({
    label,
    onRemove,
    children,
}: {
    label: string;
    onRemove: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-dashboard-base-content/10 bg-dashboard-base-200/40 p-3">
            <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-dashboard-base-content/50">{label}</span>
                <Button type="button" variant="destructive" size="icon-sm" onClick={onRemove} aria-label={`Remove ${label}`}>
                    <Trash2 />
                </Button>
            </div>
            {children}
        </div>
    );
}

export function EmptyRows({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-lg border border-dashed border-dashboard-base-content/15 px-4 py-6 text-center text-xs text-dashboard-base-content/45">
            {children}
        </p>
    );
}

/**
 * A list of plain strings — inclusions, exclusions, meals, policy points.
 *
 * Entries are edited in place rather than added through a separate input: these
 * lists are usually pasted in and then tidied, and a type-then-press-Add control
 * makes fixing a typo in entry three a delete-and-retype.
 */
export function StringListEditor({
    values,
    onChange,
    placeholder,
    addLabel,
}: {
    values: string[];
    onChange: (next: string[]) => void;
    placeholder: string;
    addLabel: string;
}) {
    return (
        <div className="space-y-2">
            {values.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Input
                        value={value}
                        placeholder={placeholder}
                        onChange={(e) => onChange(values.map((v, k) => (k === i ? e.target.value : v)))}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onChange(values.filter((_, k) => k !== i))}
                        aria-label="Remove entry"
                    >
                        <Trash2 />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ""])}>
                <Plus /> {addLabel}
            </Button>
        </div>
    );
}

/**
 * Confirmed / not, and what to print when not.
 *
 * The automatic voucher reads this off the ops tables. Here it is whatever ops
 * says it is — the hotel was booked outside the system — so both halves are
 * editable, and the status text only matters while unconfirmed, which is why it
 * disappears once the box is ticked.
 */
export function StatusFields({
    isConfirmed,
    status,
    onChange,
}: {
    isConfirmed: boolean;
    status: string;
    onChange: (next: { isConfirmed: boolean; status: string }) => void;
}) {
    return (
        <div className="flex items-end gap-3">
            <label className="flex h-10 cursor-pointer items-center gap-2 text-xs text-dashboard-base-content/80">
                <input
                    type="checkbox"
                    className="size-3.5 accent-dashboard-success"
                    checked={isConfirmed}
                    onChange={(e) => onChange({ isConfirmed: e.target.checked, status: e.target.checked ? "CONFIRMED" : "PENDING" })}
                />
                Confirmed
            </label>
            {!isConfirmed && (
                <Field label="Status shown" className="flex-1">
                    <Input
                        value={status}
                        placeholder="PENDING"
                        onChange={(e) => onChange({ isConfirmed, status: e.target.value })}
                    />
                </Field>
            )}
        </div>
    );
}
