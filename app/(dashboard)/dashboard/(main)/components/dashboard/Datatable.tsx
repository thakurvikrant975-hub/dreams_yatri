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
        <div className="border-t px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
            </p>
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href={href(currentPage - 1)}
                            onClick={(e) => handleClick(e, currentPage - 1)}
                            aria-disabled={currentPage === 1}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                    </PaginationItem>

                    {getPageNumbers().map((p, i) =>
                        p === "ellipsis" ? (
                            <PaginationItem key={`e-${i}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={p}>
                                <PaginationLink
                                    href={href(p)}
                                    onClick={(e) => handleClick(e, p)}
                                    isActive={p === currentPage}
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
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
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
        <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        {columns.map((col, i) => (
                            <TableHead
                                key={i}
                                className={[col.width ?? "", col.align ? alignClass[col.align] : ""].join(" ")}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="py-16 text-center">
                                {emptyState ?? (
                                    <p className="text-sm text-muted-foreground">No records found</p>
                                )}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((row) => (
                            <React.Fragment key={rowKey(row)}>
                                <TableRow
                                    className={[
                                        "hover:bg-muted/30",
                                        onRowClick ? "cursor-pointer" : "",
                                    ].join(" ")}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                >
                                    {columns.map((col, i) => (
                                        <TableCell
                                            key={i}
                                            className={col.align ? alignClass[col.align] : ""}
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