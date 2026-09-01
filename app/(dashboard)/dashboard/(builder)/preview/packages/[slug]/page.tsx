import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, Eye, MapPin, ImageOff } from "lucide-react";
import { db } from "@/app/lib/db";
import { getImageUrl, IMAGE_SIZES } from "@/app/lib/imageUrl";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Card, CardBody } from "@/app/components/ui/Card";

// ─────────────────────────────────────────────────────────────────────────────
// Fallback staff preview for a catalog package with no active duration/route
// configured — the itinerary-driven preview at
// ../[duration]/[route]/[stay]/page.tsx has nothing to render without one
// (package_itineraries is scoped to a duration_id + route_id), so this shows
// whatever exists at the package level instead: title, images, description,
// inclusions/exclusions, policies. See CreatePackageDialog's catalogViewUrl
// for when this route is used vs. the full itinerary preview.
// ─────────────────────────────────────────────────────────────────────────────

export default async function PackagePreviewFallbackPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const pkg = await db.packages.findUnique({
        where: { slug },
        select: {
            title: true,
            thumbnail: true,
            description: true,
            inclusions: true,
            exclusions: true,
            is_active: true,
            destination: { select: { name: true, region: { select: { name: true } } } },
            images: { orderBy: { sort_order: "asc" }, select: { url: true, is_primary: true } },
            policies: {
                orderBy: { policy: { sort_order: "asc" } },
                select: { policy: { select: { type: true, title: true, points: true } } },
            },
        },
    });

    if (!pkg) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <p className="text-lg font-semibold">Package not found</p>
                <Link href="/dashboard/package-templates" className="text-sm text-primary hover:underline">
                    Back to Package Templates
                </Link>
            </div>
        );
    }

    const imgUrl = (k: string | null | undefined) => getImageUrl(k ?? "", IMAGE_SIZES.card);
    const coverImage = imgUrl(pkg.thumbnail) || imgUrl(pkg.images.find((i) => i.is_primary)?.url) || imgUrl(pkg.images[0]?.url);

    return (
        <div className="min-h-screen bg-dashboard-base-200">
            <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-dashboard-base-300 bg-dashboard-base-100 px-4 py-2.5">
                <Link href="/dashboard/package-templates" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0">
                    <ArrowLeft className="h-4 w-4" /> Back
                </Link>
                <span className="h-4 w-px bg-dashboard-base-300 shrink-0" />
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold shrink-0">
                    <Eye className="h-4 w-4 text-primary" /> Staff Preview
                </span>
                <span className="text-sm text-muted-foreground truncate">{pkg.title}</span>
                <div className="flex-1" />
                {!pkg.is_active && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-1 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" /> Offline — not published on the public site
                    </span>
                )}
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="rounded-xl border border-amber-300 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                        This package has no active duration or route configured in the catalog yet, so there&apos;s no
                        itinerary to show — only what&apos;s set at the package level below.
                    </span>
                </div>

                <div className="relative h-56 sm:h-72 w-full rounded-xl overflow-hidden bg-dashboard-base-300">
                    {coverImage ? (
                        <Image src={coverImage} alt={pkg.title} fill className="object-cover" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                            <ImageOff className="h-8 w-8" />
                        </div>
                    )}
                </div>

                <div>
                    <h1 className="text-2xl font-bold">{pkg.title}</h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {pkg.destination.name}
                        {pkg.destination.region && <span className="text-muted-foreground/60">· {pkg.destination.region.name}</span>}
                    </p>
                </div>

                {pkg.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>
                )}

                {(pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {pkg.inclusions.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">What&apos;s Included</p>
                                <ul className="flex flex-col gap-2">
                                    {pkg.inclusions.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckIcon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <span className="text-sm text-muted-foreground">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {pkg.exclusions.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Not Included</p>
                                <ul className="flex flex-col gap-2">
                                    {pkg.exclusions.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <XMarkIcon className="size-4 text-red-500 shrink-0 mt-0.5" />
                                            <span className="text-sm text-muted-foreground">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {pkg.images.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Gallery</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {pkg.images.map((img, i) => {
                                const src = imgUrl(img.url);
                                if (!src) return null;
                                return (
                                    <div key={i} className="relative h-28 rounded-lg overflow-hidden bg-dashboard-base-300">
                                        <Image src={src} alt="" fill className="object-cover" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {pkg.policies.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Policies</p>
                        <div className="flex flex-col gap-3">
                            {pkg.policies.map((p, i) => {
                                const policy = p.policy;
                                const label =
                                    policy.type === "CANCELLATION" ? "Cancellation Policy"
                                        : policy.type === "DATE_CHANGE" ? "Date Change Policy"
                                            : policy.type === "REFUND" ? "Refund Policy"
                                                : policy.type === "TERMS_AND_CONDITIONS" ? "Terms & Conditions"
                                                    : policy.title;
                                return (
                                    <Card key={i} variant="default" padding="none">
                                        <CardBody className="p-4 flex flex-col gap-3">
                                            <div>
                                                <p className="text-sm font-bold">{label}</p>
                                                {policy.title !== label && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{policy.title}</p>
                                                )}
                                            </div>
                                            <ul className="flex flex-col gap-1.5">
                                                {policy.points.map((point, j) => (
                                                    <li key={j} className="flex items-start gap-2">
                                                        <span className="size-1.5 rounded-full bg-neutral-400 shrink-0 mt-1.75" />
                                                        <span className="text-sm text-muted-foreground leading-relaxed">{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardBody>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
