"use client";

import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import {
    computeDraftTotals,
    type ManualInvoiceDraft,
} from "@/app/lib/manual-documents";
import { Field, RepeatableRow, RepeatableSection, StringListEditor, EmptyRows } from "./editor-ui";

/**
 * The invoice body: what is being charged for, at what GST rate, and what has
 * been received against it.
 *
 * Amounts are typed in rupees and held as the strings they were typed as — see
 * ManualInvoiceDraft. The totals strip recomputes on every keystroke through the
 * same function the saved document uses, so what ops signs off here is exactly
 * what prints.
 */
export default function InvoiceFields({
    draft,
    onChange,
    errors,
}: {
    draft: ManualInvoiceDraft;
    onChange: (next: ManualInvoiceDraft) => void;
    errors: Record<string, string[]>;
}) {
    const totals = computeDraftTotals(draft);
    const set = (patch: Partial<ManualInvoiceDraft>) => onChange({ ...draft, ...patch });
    const err = (key: string) => errors[key]?.[0];

    return (
        <div className="space-y-5">
            <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                        label="Service"
                        hint="Prints above the first line and in the meta row"
                        error={err("payload.serviceType")}
                    >
                        <Input
                            value={draft.serviceType}
                            placeholder="Holiday Tour Package"
                            onChange={(e) => set({ serviceType: e.target.value })}
                        />
                    </Field>
                    <Field label="GST %" error={err("payload.gstPct")}>
                        <Input
                            type="number"
                            min={0}
                            max={28}
                            step="0.01"
                            value={draft.gstPct}
                            onChange={(e) => set({ gstPct: Number(e.target.value) })}
                        />
                    </Field>
                    <Field label="GST state code" hint="Optional — omitted from the invoice when blank">
                        <Input
                            value={draft.gstStateCode ?? ""}
                            placeholder="02"
                            onChange={(e) => set({ gstStateCode: e.target.value || null })}
                        />
                    </Field>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-lg bg-dashboard-base-200/50 px-3 py-2.5">
                    <Switch
                        id="amounts-include-gst"
                        checked={draft.amountsIncludeGst}
                        onCheckedChange={(checked) => set({ amountsIncludeGst: checked })}
                    />
                    <div>
                        <Label htmlFor="amounts-include-gst" className="cursor-pointer text-xs font-medium">
                            Amounts already include GST
                        </Label>
                        <p className="mt-0.5 text-[11px] text-dashboard-base-content/50">
                            {draft.amountsIncludeGst
                                ? "The line amounts are the all-in figure — GST is backed out of them."
                                : "GST is added on top of the line amounts."}
                        </p>
                    </div>
                </div>
            </section>

            <RepeatableSection
                title="Line items"
                description="One row per thing being charged for."
                addLabel="Add line"
                onAdd={() => set({ lines: [...draft.lines, { label: "", detail: null, amount: "" }] })}
            >
                {draft.lines.map((line, i) => (
                    <RepeatableRow
                        key={i}
                        label={`Line ${i + 1}`}
                        onRemove={() => set({ lines: draft.lines.filter((_, k) => k !== i) })}
                    >
                        <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
                            <Field label="Description" error={err(`payload.lines.${i}.label`)}>
                                <Input
                                    value={line.label}
                                    placeholder="Manali – Shimla 5N/6D package"
                                    onChange={(e) => set({ lines: draft.lines.map((l, k) => (k === i ? { ...l, label: e.target.value } : l)) })}
                                />
                            </Field>
                            <Field label="Detail" hint="Second, smaller line — optional">
                                <Input
                                    value={line.detail ?? ""}
                                    placeholder="4 travellers · 2 rooms"
                                    onChange={(e) => set({ lines: draft.lines.map((l, k) => (k === i ? { ...l, detail: e.target.value || null } : l)) })}
                                />
                            </Field>
                            <Field label="Amount (₹)" error={err(`payload.lines.${i}.amount`)}>
                                <Input
                                    inputMode="decimal"
                                    value={line.amount}
                                    placeholder="0"
                                    onChange={(e) => set({ lines: draft.lines.map((l, k) => (k === i ? { ...l, amount: e.target.value } : l)) })}
                                />
                            </Field>
                        </div>
                    </RepeatableRow>
                ))}
                {draft.lines.length === 0 && <EmptyRows>An invoice needs at least one line item.</EmptyRows>}
            </RepeatableSection>

            <RepeatableSection
                title="Payments received"
                description="Leave empty and the invoice prints the full amount as due."
                addLabel="Add payment"
                onAdd={() =>
                    set({
                        payments: [
                            ...draft.payments,
                            { label: "Cash", date: new Date().toISOString().slice(0, 10), amount: "" },
                        ],
                    })
                }
            >
                {draft.payments.length === 0 ? (
                    <EmptyRows>No payments recorded — the invoice will show the full balance as due.</EmptyRows>
                ) : (
                    draft.payments.map((payment, i) => (
                        <RepeatableRow
                            key={i}
                            label={`Payment ${i + 1}`}
                            onRemove={() => set({ payments: draft.payments.filter((_, k) => k !== i) })}
                        >
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Field label="Received as" error={err(`payload.payments.${i}.label`)}>
                                    <Input
                                        value={payment.label}
                                        placeholder="Cash / UPI / Cheque 004512"
                                        onChange={(e) => set({ payments: draft.payments.map((p, k) => (k === i ? { ...p, label: e.target.value } : p)) })}
                                    />
                                </Field>
                                <Field label="Date" error={err(`payload.payments.${i}.date`)}>
                                    <Input
                                        type="date"
                                        value={payment.date}
                                        onChange={(e) => set({ payments: draft.payments.map((p, k) => (k === i ? { ...p, date: e.target.value } : p)) })}
                                    />
                                </Field>
                                <Field label="Amount (₹)" error={err(`payload.payments.${i}.amount`)}>
                                    <Input
                                        inputMode="decimal"
                                        value={payment.amount}
                                        placeholder="0"
                                        onChange={(e) => set({ payments: draft.payments.map((p, k) => (k === i ? { ...p, amount: e.target.value } : p)) })}
                                    />
                                </Field>
                            </div>
                        </RepeatableRow>
                    ))
                )}
            </RepeatableSection>

            {/* Totals — the same arithmetic the printed document runs, so there is
                no version of this invoice where the two disagree. */}
            <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                <h3 className="mb-3 text-sm font-semibold text-dashboard-base-content">Totals</h3>
                <dl className="ml-auto max-w-xs space-y-1.5 text-xs">
                    <div className="flex justify-between">
                        <dt className="text-dashboard-base-content/60">Taxable value</dt>
                        <dd className="font-medium">{formatPaiseRoundedUp(totals.taxable)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-dashboard-base-content/60">GST ({draft.gstPct}%)</dt>
                        <dd className="font-medium">{formatPaiseRoundedUp(totals.gst)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-dashboard-base-content/10 pt-1.5">
                        <dt className="font-semibold">Total</dt>
                        <dd className="font-semibold">{formatPaiseRoundedUp(totals.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-dashboard-base-content/60">Paid</dt>
                        <dd className="font-medium">{formatPaiseRoundedUp(totals.paid)}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-dashboard-base-content/60">Balance due</dt>
                        <dd className="font-semibold">{formatPaiseRoundedUp(totals.balance)}</dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                <h3 className="text-sm font-semibold text-dashboard-base-content">Terms &amp; conditions</h3>
                <p className="mt-0.5 mb-3 text-[11px] text-dashboard-base-content/50">
                    Pre-filled with the standard conditions. Printed as a numbered list; clear them all to omit the section.
                </p>
                <StringListEditor
                    values={draft.terms}
                    onChange={(terms) => set({ terms })}
                    placeholder="Subject to Shimla jurisdiction."
                    addLabel="Add condition"
                />
            </section>
        </div>
    );
}
