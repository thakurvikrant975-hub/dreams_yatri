"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    EMPTY_INVOICE_DRAFT,
    EMPTY_VOUCHER_PAYLOAD,
    type ManualInvoiceDraft,
    type ManualVoucherPayload,
} from "@/app/lib/manual-documents";
import { createManualDocument, updateManualDocument, type ManualDocumentFormState } from "./actions";
import InvoiceFields from "./InvoiceFields";
import VoucherFields from "./VoucherFields";
import { Field } from "./editor-ui";

/**
 * One editor for both document types.
 *
 * The header — who it is for, what it is for, when — is identical across an
 * invoice and a voucher and is stored in the same columns, so it is written once
 * here and the type-specific body is delegated. The body components hold no
 * state of their own: everything lives in this one draft object, which is also
 * exactly what gets posted, so there is no assembling step between what is on
 * screen and what is saved.
 *
 * Both drafts are kept alive regardless of type. It costs nothing, and it means
 * the create page can offer a type switch without discarding what was typed.
 */

/** Header fields as the form holds them — dates are the strings a date input
 *  produces, `travellers` a number. The schema converts on the way in. */
export type HeaderDraft = {
    issueDate: string;
    guestName: string;
    guestContact: string;
    title: string;
    startDate: string;
    endDate: string;
    travellers: number;
    notes: string;
};

export type EditorInitial = {
    header: HeaderDraft;
    invoice: ManualInvoiceDraft;
    voucher: ManualVoucherPayload;
};

export function emptyHeader(): HeaderDraft {
    return {
        issueDate: new Date().toISOString().slice(0, 10),
        guestName: "",
        guestContact: "",
        title: "",
        startDate: "",
        endDate: "",
        travellers: 1,
        notes: "",
    };
}

/** Cloned, not shared: the empties are module-level constants and the form's
 *  nested arrays are edited by replacement — one form seeding itself from an
 *  object another form has already pushed rows onto would inherit them. */
export function emptyInitial(): EditorInitial {
    return {
        header: emptyHeader(),
        invoice: structuredClone(EMPTY_INVOICE_DRAFT),
        voucher: structuredClone(EMPTY_VOUCHER_PAYLOAD),
    };
}

export default function DocumentEditor({
    id,
    type,
    documentNumber,
    initial,
}: {
    /** Absent when creating — the first successful save mints the number. */
    id?: string;
    type: "INVOICE" | "VOUCHER";
    documentNumber?: string;
    initial: EditorInitial;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [header, setHeader] = useState(initial.header);
    const [invoice, setInvoice] = useState(initial.invoice);
    const [voucher, setVoucher] = useState(initial.voucher);
    const [errors, setErrors] = useState<Record<string, string[]>>({});

    const isInvoice = type === "INVOICE";
    const err = (key: string) => errors[key]?.[0];

    /** Exactly what the server validates — nothing is reshaped in between. */
    const buildInput = () => ({
        ...header,
        guestContact: header.guestContact || null,
        startDate: header.startDate || null,
        endDate: header.endDate || null,
        notes: header.notes || null,
        type,
        payload: isInvoice ? invoice : voucher,
    });

    /** `then` runs only on success — it is how "save and preview" gets the id of
     *  a document that did not exist a moment ago. */
    const save = (then?: (state: ManualDocumentFormState) => void) => {
        startTransition(async () => {
            const input = buildInput();
            const state = id ? await updateManualDocument(id, input) : await createManualDocument(input);

            setErrors(state.errors ?? {});
            if (!state.success) {
                toast.error(state.message);
                return;
            }

            toast.success(state.message);
            if (!id && state.id) {
                // A created document has a URL of its own; stay on the same form
                // but at that URL, so a reload or a back-navigation lands on the
                // saved document rather than on an empty create form.
                router.replace(`/dashboard/manual-documents/${state.id}`);
            } else {
                router.refresh();
            }
            then?.(state);
        });
    };

    return (
        <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon-sm" asChild aria-label="Back to documents">
                        <Link href="/dashboard/manual-documents"><ArrowLeft /></Link>
                    </Button>
                    <div>
                        <h1 className="text-base font-semibold text-dashboard-base-content">
                            {id ? "Edit" : "New"} {isInvoice ? "invoice" : "voucher"}
                        </h1>
                        <p className="text-[11px] text-dashboard-base-content/50">
                            {documentNumber ?? "The document number is assigned when you first save."}
                        </p>
                    </div>
                    <Badge variant={isInvoice ? "default" : "secondary"}>{isInvoice ? "Invoice" : "Voucher"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    {/* Preview goes through a save deliberately: the print page renders
                        the stored row, so previewing unsaved edits would show the old
                        document and quietly convince ops a change had not applied. */}
                    <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                            save((state) => {
                                const target = id ?? state.id;
                                if (target) router.push(`/dashboard/manual-documents/${target}/print`);
                            })
                        }
                    >
                        <Eye /> Save &amp; preview
                    </Button>
                    <Button disabled={pending} onClick={() => save()}>
                        <Save /> {pending ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            {/* ── Header ── */}
            <section className="rounded-xl border border-dashboard-base-content/10 bg-dashboard-base-100 p-4">
                <h2 className="mb-3 text-sm font-semibold text-dashboard-base-content">Document details</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Issue date" error={err("issueDate")}>
                        <Input
                            type="date"
                            value={header.issueDate}
                            onChange={(e) => setHeader({ ...header, issueDate: e.target.value })}
                        />
                    </Field>
                    <Field
                        label={isInvoice ? "Billed to" : "Guest name"}
                        error={err("guestName")}
                        className="sm:col-span-2"
                    >
                        <Input
                            value={header.guestName}
                            placeholder="Rohit Sharma"
                            onChange={(e) => setHeader({ ...header, guestName: e.target.value })}
                        />
                    </Field>
                    <Field label="Contact" hint="Phone and/or email, as it should print" className="sm:col-span-2">
                        <Input
                            value={header.guestContact}
                            placeholder="+91 98765 43210 · rohit@example.com"
                            onChange={(e) => setHeader({ ...header, guestContact: e.target.value })}
                        />
                    </Field>
                    <Field label="Travellers" error={err("travellers")}>
                        <Input
                            type="number"
                            min={1}
                            value={header.travellers}
                            onChange={(e) => setHeader({ ...header, travellers: Number(e.target.value) || 1 })}
                        />
                    </Field>
                    <Field
                        label={isInvoice ? "Reference / trip" : "Trip title"}
                        hint={isInvoice ? "Prints in the summary strip when trip dates are set" : "The headline on the voucher"}
                        error={err("title")}
                        className="sm:col-span-3"
                    >
                        <Input
                            value={header.title}
                            placeholder="Shimla – Manali 5N/6D"
                            onChange={(e) => setHeader({ ...header, title: e.target.value })}
                        />
                    </Field>
                    <Field label="Trip start" error={err("startDate")}>
                        <Input
                            type="date"
                            value={header.startDate}
                            onChange={(e) => setHeader({ ...header, startDate: e.target.value })}
                        />
                    </Field>
                    <Field label="Trip end" error={err("endDate")}>
                        <Input
                            type="date"
                            value={header.endDate}
                            onChange={(e) => setHeader({ ...header, endDate: e.target.value })}
                        />
                    </Field>
                </div>
                <div className="mt-4">
                    <Field label="Internal note" hint="Never printed — why this document was raised, who asked for it">
                        <Textarea
                            value={header.notes}
                            placeholder="Raised for Sharma Travels (B2B) — payment by cheque, collected at office."
                            onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                        />
                    </Field>
                </div>
            </section>

            {/* ── Body ── */}
            {isInvoice ? (
                <InvoiceFields draft={invoice} onChange={setInvoice} errors={errors} />
            ) : (
                <VoucherFields
                    payload={voucher}
                    onChange={setVoucher}
                    errors={errors}
                    tripStartDate={header.startDate || header.issueDate}
                />
            )}

            {/* Repeated at the foot: both forms are long enough that the toolbar is
                well off screen by the time ops finishes the last section. */}
            <div className="flex justify-end gap-2 pb-4">
                <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                        save((state) => {
                            const target = id ?? state.id;
                            if (target) router.push(`/dashboard/manual-documents/${target}/print`);
                        })
                    }
                >
                    <Eye /> Save &amp; preview
                </Button>
                <Button disabled={pending} onClick={() => save()}>
                    <Save /> {pending ? "Saving…" : "Save"}
                </Button>
            </div>
        </div>
    );
}
