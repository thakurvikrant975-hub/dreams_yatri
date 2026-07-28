"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlaneLanding, Plus, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "../components/dashboard/PageHeader";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { deleteLandingPage } from "./actions";

type LandingPageRow = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { items: number };
};

export function LandingPagesClient({ pages }: { pages: LandingPageRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<LandingPageRow | null>(null);

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteLandingPage(deleteTarget.id);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Landing Pages"
        description="Build Google-Ads-style landing pages your team can publish at /offers/[slug]"
        icon={PlaneLanding}
        actions={
          <Link href="/dashboard/landing-pages/new">
            <Button className="gap-1.5 bg-dashboard-primary text-dashboard-base-100 hover:bg-dashboard-primary">
              <Plus size={15} /> New Landing Page
            </Button>
          </Link>
        }
      />

      <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
        {pages.length === 0 ? (
          <div className="p-10 text-center text-sm text-dashboard-base-content/60">
            No landing pages yet — click &quot;New Landing Page&quot; to create your first one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dashboard-base-200 text-left text-xs font-semibold text-dashboard-base-content/70">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Packages</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashboard-base-300">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-dashboard-base-200/50">
                  <td className="px-4 py-3 font-medium text-dashboard-base-content">{p.title}</td>
                  <td className="px-4 py-3 text-dashboard-base-content/70">/offers/{p.slug}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        p.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-dashboard-base-300 text-dashboard-base-content border-dashboard-base-300"
                      }
                    >
                      {p.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-dashboard-base-content/70">{p._count.items}</td>
                  <td className="px-4 py-3 text-dashboard-base-content/70">{p.createdByName ?? "—"}</td>
                  <td className="px-4 py-3 text-dashboard-base-content/70">
                    {new Date(p.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === "PUBLISHED" && (
                        <a href={`/offers/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" className="size-8" title="View live page">
                            <ExternalLink size={14} />
                          </Button>
                        </a>
                      )}
                      <Link href={`/dashboard/landing-pages/${p.id}`}>
                        <Button variant="outline" size="icon" className="size-8" title="Edit">
                          <Pencil size={14} />
                        </Button>
                      </Link>
                      <Button
                        variant="outline" size="icon" className="size-8 text-red-600 hover:bg-red-50"
                        title="Delete" onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete landing page?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &quot;{deleteTarget?.title}&quot; and its package cards. The public /offers/{deleteTarget?.slug} URL will stop working immediately. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
