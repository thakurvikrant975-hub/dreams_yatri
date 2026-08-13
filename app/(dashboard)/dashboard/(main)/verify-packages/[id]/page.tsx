import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Package Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// There is one editor, and this is not it.
//
// Costing used to get its own screen here: a pricing breakdown beside a
// read-only summary, inside the dashboard chrome, while the exec got a
// full-width editor somewhere else. Two screens over one package, and every
// correction was a round trip between them.
//
// The review queue still links here — it is the reviewer's entry point and
// their bookmarks point at it — so this hands straight over to the editor,
// which works out from the visitor's own role that they are costing and gives
// them the Costing tab. Nothing else about the two experiences differs.
export default async function VerifyPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    redirect(`/dashboard/package-builder/${id}`);
}
