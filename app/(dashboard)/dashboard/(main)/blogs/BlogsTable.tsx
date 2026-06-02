"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams }                  from "next/navigation";
import Image                                           from "next/image";
import { toast }                                       from "sonner";
import { formatDistanceToNow }                         from "date-fns";
import {
  FileText, Clock, CheckCircle2,
  Eye,
} from "lucide-react";
import { cn }                   from "@/app/lib/utils";
import { Badge }                from "../components/ui/badge";
import { Button }               from "../components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../components/ui/select";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters }              from "../components/dashboard/Tablefilters";
import { TableEmptyState }           from "../components/dashboard/TableEmptyState";
import { BlogReviewSheet }           from "./BlogReviewSheet";
import {
  getAllBlogs, getBlogForReview, approveBlog,
  type AdminBlogRow, type AdminBlogDetail,
} from "./actions";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<AdminBlogRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_REVIEW: { label: "In Review",  variant: "default"     },
  PUBLISHED:      { label: "Published",  variant: "secondary"   },
  REJECTED:       { label: "Rejected",   variant: "destructive" },
  DRAFT:          { label: "Draft",      variant: "outline"     },
};

const STATUS_FILTERS = [
  { label: "In Review",  value: "PENDING_REVIEW" },
  { label: "Published",  value: "PUBLISHED"      },
  { label: "Rejected",   value: "REJECTED"       },
  { label: "Draft",      value: "DRAFT"          },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function BlogsTable({
  rows,
  currentPage,
  totalPages,
  totalCount,
  limit,
  search,
  status,
}: {
  rows:        AdminBlogRow[];
  currentPage: number;
  totalPages:  number;
  totalCount:  number;
  limit:       number;
  search:      string;
  status:      string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local search — debounced push to URL
  const [localSearch, setLocalSearch] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search); }, [search]);

  // Review sheet state
  const [sheetPost, setSheetPost] = useState<AdminBlogDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Optimistic row status update after approve/reject
  const [localRows, setLocalRows] = useState<AdminBlogRow[]>(rows);
  useEffect(() => { setLocalRows(rows); }, [rows]);

  // ── URL helpers ────────────────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") p.delete(key); else p.set(key, value);
    p.delete("page");
    startTransition(() => router.replace(`?${p.toString()}`));
  }

  function handleSearch(value: string) {
    setLocalSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParam("search", value), 400);
  }

  function buildHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `?${params.toString()}`;
  }

  // ── Quick approve from table row ───────────────────────────────────────────

  function handleQuickApprove(id: string) {
    startTransition(async () => {
      const result = await approveBlog(id);
      if (result.success) {
        toast.success("Blog approved and published!");
        setLocalRows((prev) => prev.map((r) => r.id === id ? { ...r, status: "PUBLISHED" } : r));
      } else {
        toast.error(result.error);
      }
    });
  }

  // ── Open review sheet ──────────────────────────────────────────────────────

  async function openReview(id: string) {
    setLoadingId(id);
    const detail = await getBlogForReview(id);
    setLoadingId(null);
    if (!detail) { toast.error("Could not load post"); return; }
    setSheetPost(detail);
    setSheetOpen(true);
  }

  function handleSheetAction(id: string, action: "approved" | "rejected") {
    setLocalRows((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: action === "approved" ? "PUBLISHED" : "REJECTED" } : r)
    );
  }

  // ── Pagination label ───────────────────────────────────────────────────────

  const from  = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
  const to    = Math.min(currentPage * limit, totalCount);
  const label = `Showing ${from}–${to} of ${totalCount} post${totalCount !== 1 ? "s" : ""}`;

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: ColumnDef<AdminBlogRow>[] = [
    {
      header: "Post",
      width:  "w-[280px]",
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-lg overflow-hidden bg-dashboard-base-200 border border-dashboard-base-300 shrink-0 flex items-center justify-center">
            {row.cover_image ? (
              <Image src={row.cover_image} alt="" width={40} height={40}
                className="w-full h-full object-cover" unoptimized />
            ) : (
              <FileText className="size-4.5 text-dashboard-base-content/30" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-dashboard-base-content truncate max-w-52">
              {row.title || <span className="italic text-dashboard-base-content/40">Untitled</span>}
            </p>
            {row.read_time && (
              <p className="text-[11px] text-dashboard-base-content/50 flex items-center gap-1">
                <Clock className="size-3" /> {row.read_time} min read
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Author",
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-dashboard-base-content truncate max-w-36">{row.author_name ?? "—"}</p>
          <p className="text-[11px] text-dashboard-base-content/50 truncate max-w-36">{row.author_email ?? ""}</p>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        const cfg = STATUS_BADGE[row.status];
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      header: "Category",
      cell: (row) => row.category
        ? <Badge variant="outline" className="font-normal text-xs">{row.category}</Badge>
        : <span className="text-xs text-dashboard-base-content/30">—</span>,
    },
    {
      header: "Date",
      cell: (row) => {
        const date = row.submitted_at ?? row.created_at;
        return (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-dashboard-base-content/80">
              {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-[11px] text-dashboard-base-content/45">
              {formatDistanceToNow(new Date(date), { addSuffix: true })}
            </p>
          </div>
        );
      },
    },
    {
      header:  "Actions",
      align:   "right",
      width:   "w-[130px]",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReview(row.id)}
            disabled={loadingId === row.id}
            className="h-8 px-2.5 gap-1 text-xs"
          >
            {loadingId === row.id
              ? <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Eye className="size-3.5" />
            }
            Review
          </Button>
          {row.status === "PENDING_REVIEW" && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => handleQuickApprove(row.id)}
              className="h-8 px-2.5 gap-1 text-xs bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
            >
              <CheckCircle2 className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">

        {/* Filters + rows-per-page */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <TableFilters
            search={localSearch}
            onSearchChange={handleSearch}
            searchPlaceholder="Search title or author…"
            className="flex-1"
            filters={[
              {
                value:       status,
                onChange:    (v) => updateParam("status", v),
                placeholder: "All Statuses",
                width:       "w-40",
                options:     STATUS_FILTERS,
              },
            ]}
            filteredCount={totalCount}
            totalCount={totalCount}
          />

          <Select
            value={String(limit)}
            onValueChange={(v) => {
              const p = new URLSearchParams(searchParams.toString());
              p.set("limit", v); p.delete("page");
              startTransition(() => router.replace(`?${p.toString()}`));
            }}
          >
            <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}
                  className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 rounded-lg cursor-pointer">
                  {n} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable
          data={localRows}
          columns={columns}
          rowKey={(r) => r.id}
          rowClassName={(r) => cn(r.status === "PENDING_REVIEW" && "bg-amber-50/40")}
          emptyState={
            <TableEmptyState
              title="No blog posts"
              description="Posts submitted by users will appear here."
            />
          }
          pagination={{
            currentPage,
            totalPages,
            buildHref,
            label,
          }}
        />
      </div>

      <BlogReviewSheet
        post={sheetPost}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAction={handleSheetAction}
      />
    </>
  );
}
