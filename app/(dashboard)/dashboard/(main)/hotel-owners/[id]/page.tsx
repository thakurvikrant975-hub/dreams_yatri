import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Mail, Phone, Building2, ShieldCheck, ShieldAlert } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Badge } from "../../components/ui/badge";
import { getHotelOwnerDetail } from "../actions";
import { MarkVerifiedButton } from "./MarkVerifiedButton";
import {
    computeEffectiveWizardStep, totalTabsFor, wizardCompletenessPct,
} from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/wizard-progress";

export const metadata: Metadata = {
    title: "Hotel Owner - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    DRAFT:        { label: "Draft",        className: "bg-slate-500/10 text-slate-600 border-slate-200" },
    SUBMITTED:    { label: "Submitted",    className: "bg-blue-500/10 text-blue-600 border-blue-200" },
    UNDER_REVIEW: { label: "Under Review", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
    APPROVED:     { label: "Approved",     className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
    LIVE:         { label: "Live",         className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
    REJECTED:     { label: "Rejected",     className: "bg-red-500/10 text-red-600 border-red-200" },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-dashboard-neutral">{label}</dt>
            <dd className="mt-0.5 text-sm text-dashboard-base-content">{value || "—"}</dd>
        </div>
    );
}

export default async function HotelOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const owner = await getHotelOwnerDetail(id);
    if (!owner) notFound();

    const verified = owner.verifiedAt != null;

    const properties = owner.hotels.map((h) => {
        const totalTabs = totalTabsFor(h.property_category);
        const reachedStep = computeEffectiveWizardStep({
            property_category: h.property_category,
            address: h.address, city: h.city, state: h.state, country: h.country,
            pincode: h.pincode, latitude: h.latitude, wizard_step: h.wizard_step,
            roomCount: h._count.hotelRooms, imageCount: h._count.images,
        });
        return { ...h, completenessPct: wizardCompletenessPct(reachedStep, totalTabs) };
    });

    return (
        <div className="flex flex-col gap-5">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbLink href="/dashboard/hotel-owners">Hotel Owners</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem><BreadcrumbPage>{owner.name}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{owner.name}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">Joined {fmtDateTime(owner.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {verified ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                            <ShieldCheck className="size-3" /> Verified
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                            <ShieldAlert className="size-3" /> Unverified
                        </Badge>
                    )}
                    <Badge variant="outline">{titleCase(owner.status)}</Badge>
                    <MarkVerifiedButton ownerId={owner.id} verified={verified} />
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                <div className="lg:col-span-2 flex flex-col gap-5">
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                        <div className="border-b border-dashboard-base-300 px-5 py-3">
                            <h2 className="text-sm font-semibold text-dashboard-base-content">Properties ({properties.length})</h2>
                        </div>
                        <div className="p-5">
                            {properties.length === 0 ? (
                                <p className="text-sm text-dashboard-neutral">No properties listed yet.</p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {properties.map((p) => {
                                        const cfg = STATUS_CONFIG[p.listing_status] ?? { label: p.listing_status, className: "bg-muted text-muted-foreground" };
                                        return (
                                            <li key={p.id} className="rounded-lg border border-dashboard-base-300/70 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Link
                                                                href={`/dashboard/property-submissions/${p.id}`}
                                                                target="_blank"
                                                                className="text-sm font-medium text-dashboard-primary hover:underline inline-flex items-center gap-1"
                                                            >
                                                                {p.name}
                                                                <ExternalLink className="size-3.5" />
                                                            </Link>
                                                            <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                                                        </div>
                                                        <p className="text-xs text-dashboard-neutral mt-1">
                                                            {[p.city, p.state].filter(Boolean).join(", ") || "Location not set"}
                                                        </p>
                                                    </div>
                                                    {p.listing_status === "DRAFT" && (
                                                        <div className="shrink-0 text-right">
                                                            <div className="text-xs font-semibold text-dashboard-base-content">{p.completenessPct}%</div>
                                                            <div className="mt-1 h-1.5 w-24 rounded-full bg-dashboard-base-300 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-dashboard-primary"
                                                                    style={{ width: `${p.completenessPct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                        <div className="border-b border-dashboard-base-300 px-5 py-3 flex items-center gap-2">
                            <Building2 className="size-4 text-dashboard-primary" />
                            <h2 className="text-sm font-semibold text-dashboard-base-content">Owner details</h2>
                        </div>
                        <div className="p-5 flex flex-col gap-3">
                            <Field label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-dashboard-neutral" />{owner.email}</span>} />
                            <Field label="Phone" value={owner.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-dashboard-neutral" />{owner.phone_cc} {owner.phone}</span> : null} />
                            <Field label="WhatsApp" value={owner.whatsapp ? `${owner.whatsapp_cc ?? ""} ${owner.whatsapp}` : null} />
                            <Field label="Business name" value={owner.businessName} />
                            <Field label="Founded" value={owner.founded_year} />
                            <Field label="Email confirmed" value={owner.email_verified ? "Yes" : "No"} />
                            {verified && (
                                <Field
                                    label="Admin verified"
                                    value={`${fmtDate(owner.verifiedAt)}${owner.verifiedByName ? ` by ${owner.verifiedByName}` : ""}`}
                                />
                            )}
                            <Field label="Last login" value={fmtDateTime(owner.lastLoginAt)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
