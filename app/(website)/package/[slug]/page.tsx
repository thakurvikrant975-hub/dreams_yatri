import { redirect, notFound } from "next/navigation";
import { db } from "@/app/lib/db";

export default async function PackageRedirectPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const pkg = await db.packages.findUnique({
        where: { slug },
        select: {
            durations: {
                where: { is_active: true },
                orderBy: { sort_order: "asc" },
                select: { slug: true, is_default: true },
            },
        },
    });

    if (!pkg) notFound();

    const defaultDuration =
        pkg.durations.find(d => d.is_default) ?? pkg.durations[0];

    if (!defaultDuration) notFound();

    redirect(`/package/${slug}/${defaultDuration.slug}`);
}