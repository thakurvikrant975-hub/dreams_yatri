"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Plus, Printer, Search, Ticket, Trash2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { deleteManualDocument, type ManualDocumentListRow } from "./actions";

/**
 * Everything ops has issued by hand, newest first.
 *
 * Filters live in the URL rather than in component state: a document number
 * someone is chasing gets shared over chat as a link, and a filtered list that
 * resets on reload is one ops has to rebuild every time it comes back.
 */

const TYPES = [
    { value: "all", label: "All" },
    { value: "INVOICE", label: "Invoices" },
    { value: "VOUCHER", label: "Vouchers" },
] as const;

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default function ManualDocumentsClient({
    documents,
    totalCount,
    isFiltering,
    stats,
    page,
    limit,
    search,
    type,
}: {
    documents: ManualDocumentListRow[];
    totalCount: number;
    isFiltering: boolean;
    stats: { total: number; invoices: number; vouchers: number };
    page: number;
    limit: number;
    search: string;
    type: "all" | "INVOICE" | "VOUCHER";
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(search);
    const [pendingDelete, setPendingDelete] = useState<ManualDocumentListRow | null>(null);
    const [pending, startTransition] = useTransition();

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    /** Rewrites one filter, resetting to page 1 — a search that keeps you on
     *  page 4 of a result set two pages long shows an empty table. */
    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams.toString());
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        router.push(`/dashboard/manual-documents?${next.toString()}`);
    };

    const confirmDelete = () => {
        if (!pendingDelete) return;
        const target = pendingDelete;
        startTransition(async () => {
            const result = await deleteManualDocument(target.id);
            setPendingDelete(null);
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="space-y-5 px-4 py-6">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-base font-semibold text-dashboard-base-content">Manual Documents</h1>
                    <p className="mt-0.5 text-xs text-dashboard-base-content/55">
                        Invoices and vouchers raised by hand — {stats.invoices} invoice{stats.invoices !== 1 ? "s" : ""},{" "}
                        {stats.vouchers} voucher{stats.vouchers !== 1 ? "s" : ""}.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/manual-documents/new"><Plus /> New document</Link>
                </Button>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-64 flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-dashboard-base-content/40" />
                    <Input
                        value={query}
                        placeholder="Search by number, guest or title"
                        className="pl-9"
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && setParam("search", query.trim())}
                        onBlur={() => query.trim() !== search && setParam("search", query.trim())}
                    />
                </div>
                <div className="flex items-center gap-1">
                    {TYPES.map((t) => (
                        <Button
                            key={t.value}
                            variant={type === t.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setParam("type", t.value)}
                        >
                            {t.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="overflow-hidden rounded-xl border border-dashboard-base-content/10">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Guest</TableHead>
                            <TableHead>Trip / reference</TableHead>
                            <TableHead>Dates</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Raised by</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {documents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-12 text-center text-xs text-dashboard-base-content/45">
                                    {isFiltering
                                        ? "No documents match those filters."
                                        : "Nothing raised yet. Use “New document” to create the first invoice or voucher."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            documents.map((doc) => (
                                <TableRow key={doc.id}>
                                    <TableCell>
                                        <Link
                                            href={`/dashboard/manual-documents/${doc.id}`}
                                            className="flex items-center gap-2 font-medium hover:underline"
                                        >
                                            {doc.type === "INVOICE"
                                                ? <FileText className="size-3.5 text-dashboard-base-content/40" />
                                                : <Ticket className="size-3.5 text-dashboard-base-content/40" />}
                                            {doc.documentNumber}
                                        </Link>
                                        <span className="mt-0.5 block text-[11px] text-dashboard-base-content/45">
                                            {fmtDate(doc.issueDate)}
                                        </span>
                                    </TableCell>
                                    <TableCell>{doc.guestName}</TableCell>
                                    <TableCell className="max-w-56 truncate">{doc.title}</TableCell>
                                    <TableCell className="text-[11px] text-dashboard-base-content/60">
                                        {doc.startDate ? `${fmtDate(doc.startDate)} – ${fmtDate(doc.endDate)}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {/* A voucher carries no money — a column of ₹0 down the
                                            voucher rows would read as "free", not "not applicable". */}
                                        {doc.type === "INVOICE"
                                            ? formatPaiseRoundedUp(doc.totalAmount_paise)
                                            : <Badge variant="outline">Voucher</Badge>}
                                    </TableCell>
                                    <TableCell className="text-[11px] text-dashboard-base-content/60">
                                        {doc.createdByName ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon-sm" asChild aria-label="Print">
                                                <Link href={`/dashboard/manual-documents/${doc.id}/print`}><Printer /></Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Delete"
                                                onClick={() => setPendingDelete(doc)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-dashboard-base-content/55">
                    <span>Page {page} of {totalPages} · {totalCount} document{totalCount !== 1 ? "s" : ""}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setParam("page", String(page - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setParam("page", String(page + 1))}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {pendingDelete?.documentNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the record permanently. If the document has already been sent to the guest,
                            consider correcting it instead — the number stays the same and the copy they hold stays valid.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={pending} onClick={confirmDelete}>
                            {pending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
