import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { PackagePdfViewer } from "./PackagePdfViewer";

export const metadata: Metadata = {
    title: "Package PDF - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function PackagePdfPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const pkg = await db.custom_packages.findUnique({
        where: { id },
        select: { id: true, readyAt: true },
    });
    if (!pkg || !pkg.readyAt) notFound();

    return <PackagePdfViewer packageId={id} />;
}
