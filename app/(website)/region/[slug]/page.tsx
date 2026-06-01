import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { fetchRegionBySlug, fetchRegionPackages } from "@/app/actions/regions/fetch-region-page";
import Breadcrumps from "@/app/components/ui/Breadcrumps";
import { Heading, Text } from "@/app/components/ui/Typography";
import RegionPackagesList from "./RegionPackagesList";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const region = await fetchRegionBySlug(slug);
    if (!region) return { title: "Region not found | Dreams Yatri" };
    return {
        title: region.metaTitle ?? `${region.name} Tour Packages | Dreams Yatri`,
        description: region.metaDesc ?? region.description ?? `Explore curated tour packages across ${region.name}.`,
    };
}

export default async function RegionPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const region = await fetchRegionBySlug(slug);
    if (!region) notFound();

    const firstPage = await fetchRegionPackages(region.id, 1);
    const countLabel = `${firstPage.total} package${firstPage.total !== 1 ? "s" : ""} available`;

    return (
        <>
            {region.coverImage ? (
                /* ── Cover hero banner (uses region.cover_image, falls back to thumbnail) ── */
                <section className="relative w-full h-64 sm:h-80 lg:h-96 overflow-hidden">
                    <Image
                        src={region.coverImage}
                        alt={region.name}
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/10" />
                    <div className="absolute inset-0 flex items-end">
                        <div className="screen-space w-full pb-7">
                            <Breadcrumps title={region.name} className="**:text-white/80!" />
                            <Heading level={1} weight="semibold" className="text-white mt-1">
                                {region.name} Tour Packages
                            </Heading>
                            {region.description && (
                                <Text size="sm" className="text-white/85 mt-2 max-w-3xl leading-relaxed line-clamp-3">
                                    {region.description}
                                </Text>
                            )}
                            <Text size="xs" className="text-white/70 mt-3 block">
                                {countLabel}
                            </Text>
                        </div>
                    </div>
                </section>
            ) : (
                /* ── Plain text header when no cover/thumbnail is set ── */
                <div className="screen-space pt-6">
                    <Breadcrumps title={region.name} />
                    <header className="mt-2">
                        <Heading level={1} weight="semibold">
                            {region.name} Tour Packages
                        </Heading>
                        {region.description && (
                            <Text size="sm" intent="secondary" className="mt-2 max-w-3xl leading-relaxed">
                                {region.description}
                            </Text>
                        )}
                        <Text size="xs" intent="muted" className="mt-3 block">
                            {countLabel}
                        </Text>
                    </header>
                </div>
            )}

            <div className="screen-space pt-8 pb-12">
                <RegionPackagesList regionId={region.id} initial={firstPage} />
            </div>
        </>
    );
}
