"use client";

import React from "react";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "../ui/table";
import {
    Pagination, PaginationContent, PaginationEllipsis,
    PaginationItem, PaginationLink,
    PaginationNext, PaginationPrevious,
} from "../ui/pagination";

// ── Column Definition ─────────────────────────────────────────────────────────
export interface ColumnDef<T> {
    header: string;
    width?: string;
    align?: "left" | "center" | "right";
    cell: (row: T) => React.ReactNode;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function TablePagination({
    currentPage,
    totalPages,
    buildHref,
    onPageChange,
}: {
    currentPage:   number;
    totalPages:    number;
    buildHref?:    (page: number) => string;
    onPageChange?: (page: number) => void;
}) {
    if (totalPages <= 1) return null;

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
        const end   = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);

        if (currentPage < totalPages - 2) pages.push("ellipsis");
        pages.push(totalPages);
        return pages;
    }

    return (
        <div className="border-t border-dashboard-base-300 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-dashboard-base-content/45">
                Page {currentPage} of {totalPages}
            </p>
            <Pagination>
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
            </Pagination>
        </div>
    );
}

// ── DataTable ─────────────────────────────────────────────────────────────────
interface DataTableProps<T> {
    data:           T[];
    columns:        ColumnDef<T>[];
    rowKey:         (row: T) => string | number;
    onRowClick?:    (row: T) => void;
    rowClassName?:  (row: T) => string;
    renderSubRows?: (row: T) => React.ReactNode;
    emptyState?:    React.ReactNode;
    pagination?: {
        currentPage:   number;
        totalPages:    number;
        buildHref?:    (page: number) => string;
        onPageChange?: (page: number) => void;
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

    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-dashboard-base-200 border-b border-dashboard-base-300 hover:bg-dashboard-base-200">
                        {columns.map((col, i) => (
                            <TableHead
                                key={i}
                                className={[
                                    "text-xs font-semibold uppercase tracking-wide text-dashboard-neutral-content bg-dashboard-neutral",
                                    col.width ?? "",
                                    col.align ? alignClass[col.align] : "",
                                ].join(" ")}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {data.length === 0 ? (
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
                        data.map((row) => (
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
                />
            )}
        </div>
    );
}