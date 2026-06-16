import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { fetchDestinationBySlug, fetchDestinationPackages, getAllDestinationSlugs } from "@/app/actions/destinations/fetch-destination-page";
import Breadcrumps from "@/app/components/ui/Breadcrumps";
import { Heading, Text } from "@/app/components/ui/Typography";
import DestinationPackagesList from "./DestinationPackagesList";
import { SITE_CONFIG, SITE_URL } from "@/app/lib/seo/site-config";

export const revalidate = 3600;

export async function generateStaticParams() {
    const slugs = await getAllDestinationSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const dest = await fetchDestinationBySlug(slug);
    if (!dest) return { title: "Destination not found | Dreams Yatri" };
    const title = dest.metaTitle ?? `${dest.name} Tour Packages | Dreams Yatri`;
    const description = dest.metaDesc ?? dest.description ?? `Explore curated tour packages for ${dest.name}.`;
    const canonical = `${SITE_URL}/destination/${slug}`;
    const ogImage = dest.coverImage ?? SITE_CONFIG.defaultOgImage;
    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            title,
            description,
            url: canonical,
            siteName: SITE_CONFIG.name,
            type: "website",
            images: [{ url: ogImage, width: 1200, height: 630, alt: dest.name }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [ogImage],
        },
    };
}

export default async function DestinationPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const dest = await fetchDestinationBySlug(slug);
    if (!dest) notFound();

    const firstPage = await fetchDestinationPackages(dest.id, 1);
    const countLabel = `${firstPage.total} package${firstPage.total !== 1 ? "s" : ""} available`;
    const regionCrumb = dest.region ? { label: dest.region.name, link: `/region/${dest.region.slug}` } : null;

    return (
        <>
            {dest.coverImage ? (
                /* ── Cover hero banner (uses destination.cover_image, falls back to thumbnail) ── */
                <section className="relative w-full h-64 sm:h-80 lg:h-96 overflow-hidden">
                    <Image
                        src={dest.coverImage}
                        alt={dest.name}
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-black/10" />
                    <div className="absolute inset-0 flex items-end">
                        <div className="screen-space w-full pb-7">
                            <Breadcrumps cat={regionCrumb} title={dest.name} className="**:text-white/80!" />
                            <Heading level={1} weight="semibold" className="text-white mt-1">
                                {dest.name} Tour Packages
                            </Heading>
                            {dest.description && (
                                <Text size="sm" className="text-white/85 mt-2 max-w-3xl leading-relaxed line-clamp-3">
                                    {dest.description}
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
                    <Breadcrumps cat={regionCrumb} title={dest.name} />
                    <header className="mt-2">
                        <Heading level={1} weight="semibold">
                            {dest.name} Tour Packages
                        </Heading>
                        {dest.description && (
                            <Text size="sm" intent="secondary" className="mt-2 max-w-3xl leading-relaxed">
                                {dest.description}
                            </Text>
                        )}
                        <Text size="xs" intent="muted" className="mt-3 block">
                            {countLabel}
                        </Text>
                    </header>
                </div>
            )}

            <div className="screen-space pt-8 pb-12">
                <DestinationPackagesList destinationId={dest.id} initial={firstPage} />
            </div>
        </>
    );
}
