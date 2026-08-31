"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "../ui/table";
import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink,
    PaginationNext, PaginationPrevious,
} from "../ui/pagination";
import { cn } from "@/app/lib/utils";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from "../ui/select";

// ── Column Definition ─────────────────────────────────────────────────────────
export interface ColumnDef<T> {
    /** Usually a label; pass a node (e.g. a select-all checkbox) for a
     * non-text header. Non-string headers are never sortable. */
    header: React.ReactNode;
    width?: string;
    align?: "left" | "center" | "right";
    cell: (row: T) => React.ReactNode;
    /** Return a primitive to enable client-side sorting on this column. */
    sortKey?: (row: T) => string | number | Date | null | undefined;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function TablePagination({
    currentPage,
    totalPages,
    buildHref,
    onPageChange,
    label,
    pageSize,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
}: {
    currentPage: number;
    totalPages: number;
    buildHref?: (page: number) => string;
    onPageChange?: (page: number) => void;
    label?: string;
    pageSize?: number;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
}) {
    const showPagination = totalPages > 1;
    const showPageSize = pageSize != null && typeof onPageSizeChange === "function";
    if (!showPagination && !label && !showPageSize) return null;

    const isClientSide = typeof onPageChange === "function";
    const href = buildHref ?? ((p: number) => `?page=${p}`);

    function handleClick(e: React.MouseEvent, p: number) {
        if (isClientSide) {
            e.preventDefault();
            onPageChange!(p);
        }
    }

    function getPageNumbers(): (number | "ellipsis")[] {
        if (totalPages <= 5)
            return Array.from({ length: totalPages }, (_, i) => i + 1);

        const pages: (number | "ellipsis")[] = [1];
        if (currentPage > 3) pages.push("ellipsis");

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);

        if (currentPage < totalPages - 2) pages.push("ellipsis");
        pages.push(totalPages);
        return pages;
    }

    return (
        <div className="border-t border-dashboard-base-300 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 shrink-0">
                <p className="text-xs text-dashboard-base-content/75 whitespace-nowrap">
                    {label ?? `Page ${currentPage} of ${totalPages}`}
                </p>
                {showPageSize && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-dashboard-base-content/60 whitespace-nowrap">Rows per page</span>
                        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange!(Number(v))}>
                            <SelectTrigger className="h-8 w-[70px] text-xs rounded-md border-dashboard-base-300 bg-dashboard-base-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-dashboard-base-300 bg-dashboard-base-100">
                                {pageSizeOptions.map((n) => (
                                    <SelectItem key={n} value={String(n)} className="text-xs cursor-pointer">
                                        {n}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            {showPagination && <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href={href(currentPage - 1)}
                            onClick={(e) => handleClick(e, currentPage - 1)}
                            aria-disabled={currentPage === 1}
                            className={[
                                "text-dashboard-base-content hover:bg-dashboard-base-200 hover:text-dashboard-base-content",
                                currentPage === 1 ? "pointer-events-none opacity-50" : "",
                            ].join(" ")}
                        />
                    </PaginationItem>

                    {getPageNumbers().map((p, i) =>
                        p === "ellipsis" ? (
                            <PaginationItem key={`e-${i}`}>
                                <PaginationEllipsis className="text-dashboard-base-content/45" />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={p}>
                                <PaginationLink
                                    href={href(p)}
                                    onClick={(e) => handleClick(e, p)}
                                    isActive={p === currentPage}
                                    className={
                                        p === currentPage
                                            ? "bg-dashboard-neutral text-dashboard-neutral-content border-dashboard-neutral"
                                            : "text-dashboard-base-content hover:bg-dashboard-neutral/5 border-transparent"
                                    }
                                >
                                    {p}
                                </PaginationLink>
                            </PaginationItem>
                        ),
                    )}

                    <PaginationItem>
                        <PaginationNext
                            href={href(currentPage + 1)}
                            onClick={(e) => handleClick(e, currentPage + 1)}
                            aria-disabled={currentPage === totalPages}
                            className={[
                                "text-dashboard-base-content hover:bg-dashboard-neutral/5 hover:text-dashboard-base-content",
                                currentPage === totalPages ? "pointer-events-none opacity-50" : "",
                            ].join(" ")}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>}
        </div>
    );
}

// ── DataTable ─────────────────────────────────────────────────────────────────
interface DataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    rowKey: (row: T) => string | number;
    onRowClick?: (row: T) => void;
    rowClassName?: (row: T) => string;
    renderSubRows?: (row: T) => React.ReactNode;
    emptyState?: React.ReactNode;
    pagination?: {
        currentPage: number;
        totalPages: number;
        buildHref?: (page: number) => string;
        onPageChange?: (page: number) => void;
        label?: string;
        pageSize?: number;
        onPageSizeChange?: (pageSize: number) => void;
        pageSizeOptions?: number[];
    };
}

export function DataTable<T>({
    data,
    columns,
    rowKey,
    onRowClick,
    rowClassName,
    renderSubRows,
    emptyState,
    pagination,
}: DataTableProps<T>) {
    const alignClass = {
        left:   "text-left",
        center: "text-center",
        right:  "text-right",
    };

    // ── Sort state ─────────────────────────────────────────────────────────────
    const [sortCol, setSortCol] = useState<number | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    function handleHeaderClick(colIndex: number) {
        if (!columns[colIndex].sortKey) return;
        if (sortCol === colIndex) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortCol(colIndex);
            setSortDir("asc");
        }
    }

    const sortedData = useMemo(() => {
        if (sortCol === null || !columns[sortCol]?.sortKey) return data;
        const key = columns[sortCol].sortKey!;
        return [...data].sort((a, b) => {
            const va = key(a) ?? "";
            const vb = key(b) ?? "";
            let cmp = 0;
            if (va < vb) cmp = -1;
            else if (va > vb) cmp = 1;
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [data, sortCol, sortDir, columns]);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-dashboard-base-200 border-b border-dashboard-base-300 hover:bg-dashboard-base-200">
                        {columns.map((col, i) => {
                            const sortable  = !!col.sortKey;
                            const isActive  = sortCol === i;
                            const SortIcon  = isActive
                                ? (sortDir === "asc" ? ArrowUp : ArrowDown)
                                : ChevronsUpDown;

                            return (
                                <TableHead
                                    key={i}
                                    onClick={sortable ? () => handleHeaderClick(i) : undefined}
                                    className={cn(
                                        "text-xs font-semibold uppercase tracking-wide text-dashboard-neutral-content bg-dashboard-neutral",
                                        col.width ?? "",
                                        col.align ? alignClass[col.align] : "",
                                        sortable && "cursor-pointer select-none hover:bg-dashboard-neutral/80 transition-colors",
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5",
                                        col.align === "center" && "justify-center w-full",
                                        col.align === "right"  && "justify-end w-full",
                                    )}>
                                        {col.header}
                                        {sortable && (
                                            <SortIcon className={cn(
                                                "h-3 w-3 shrink-0",
                                                isActive
                                                    ? "text-dashboard-neutral-content"
                                                    : "text-dashboard-neutral-content/40",
                                            )} />
                                        )}
                                    </span>
                                </TableHead>
                            );
                        })}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {sortedData.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columns.length} className="py-16 text-center">
                                {emptyState ?? (
                                    <p className="text-sm text-dashboard-base-content/45">
                                        No records found
                                    </p>
                                )}
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((row) => (
                            <React.Fragment key={rowKey(row)}>
                                <TableRow
                                    className={[
                                        "border-b border-dashboard-base-300 transition-colors",
                                        onRowClick ? "cursor-pointer" : "",
                                        rowClassName
                                            ? rowClassName(row)
                                            : "hover:bg-dashboard-base-200",
                                    ].join(" ")}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                >
                                    {columns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            className={[
                                                "text-sm text-dashboard-base-content",
                                                col.align ? alignClass[col.align] : "",
                                            ].join(" ")}
                                        >
                                            {col.cell(row)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                {renderSubRows?.(row)}
                            </React.Fragment>
                        ))
                    )}
                </TableBody>
            </Table>

            {pagination && (
                <TablePagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    buildHref={pagination.buildHref}
                    onPageChange={pagination.onPageChange}
                    label={pagination.label}
                    pageSize={pagination.pageSize}
                    onPageSizeChange={pagination.onPageSizeChange}
                    pageSizeOptions={pagination.pageSizeOptions}
                />
            )}
        </div>
    );
}
