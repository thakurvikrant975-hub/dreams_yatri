import type { Metadata } from "next";
import { getManualDocuments } from "./actions";
import ManualDocumentsClient from "./ManualDocumentsClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Manual Documents - Dashboard",
    description: "",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [20, 50, 100] as const;

export default async function ManualDocumentsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLimit = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLimit) ? rawLimit : 20;
    const search = (sp.search ?? "").trim();
    const type = sp.type === "INVOICE" || sp.type === "VOUCHER" ? sp.type : "all";

    const { documents, totalCount, isFiltering, stats } = await getManualDocuments({ page, limit, search, type });

    return (
        <ManualDocumentsClient
            documents={documents}
            totalCount={totalCount}
            isFiltering={isFiltering}
            stats={stats}
            page={page}
            limit={limit}
            search={search}
            type={type}
        />
    );
}
