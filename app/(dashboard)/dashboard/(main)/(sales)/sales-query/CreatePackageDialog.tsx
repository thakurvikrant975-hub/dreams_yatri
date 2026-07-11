"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Package, Search, MapPin, Route, BedDouble, CalendarDays, Loader2, Sparkles, ArrowRight, IndianRupee,
    Users, Calendar,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { getCardImage } from "@/app/lib/imageUrl";
import {
    searchPackageLibraryForTemplate, getTemplatePackagePriceForCategory, type TemplatePackage,
} from "../package-library/actions";
import { copyPackageIntoDraft } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

const PAGE_SIZE = 12;
 
const LOADING_MESSAGES = [
    "Hold on... we're doing full Indian-level jugaad to get you the best deal. 😎",
    "One sec... even our calculator is negotiating the prices. 💸",
    "Good things take time. Great Indian deals take a little longer. 😉",
    "Please wait... we're finding prices your dad would approve of. 😂",
    "Loading... because 'cheap and best' isn't found in one click. 😏",
    "Relax, bro. We're cooking your perfect trip. 🍳",
    "Our servers are working harder than students one night before exams. 📚",
    "Almost there... just convincing the discounts to cooperate. 🤝",
    "Finding a better deal than your cousin's travel agent... give us a second. 😄",
    "Patience! Even Indian trains don't always arrive instantly. 🚆",
    "We're squeezing every last rupee out of these prices. 💰",
    "Trust the process... this itinerary is getting the VIP treatment. ✨",
    "Your package is loading faster than your relatives ask, 'When are you getting married?' 😂",
    "We're doing the maths so you don't have to. No tuition required. 📊",
    "One chai break later, your trip will be ready. ☕",
    "Still loading... because legendary trips aren't made in a hurry. 🔥",
    "Finding hidden deals like your mom finds things you thought were lost. 😅",
    "Almost done... adding a little extra paisa vasool. 💯",
    "Our system is in full jugaad mode. Sit tight! 🚀",
    "Just a moment... we're making sure every rupee works overtime. 💸",
    "If I finish too quickly, you'll never know how much effort we developers put into building this. 😏",
    "Hold on... I'm flirting with the pricing engine. 💸",
    "Don't stare at the loading screen... you'll make me uncomfortable. Besharam 🫣",
    "You click fast. I think we should slow this relationship down. 😉",
    "Let me work harder than the sales team at month end. 📈",
    "If this itinerary gets approved, you owe me a coffee date. ☕😏",
    "Lol! The client's gonna think you spent hours building this itinerary. 🤫🤣🤣",
    "I built this itinerary—don't take my credit. 🙏🙏",
    "This itinerary has 45,000 margin and i will send you 10,000 we will half half it.",
    "This itinerary has a ₹45,000 margin. I'll send you ₹10,000—we'll split it 50-50. 💸🤑💰",
    "This loading is fake... I was busy thinking about you instead of coding. 😏❤️",
    "One more click and I'm telling Developers that you abused me. 😤",
    "If this closes the deal, I expect a momo party. 🥳",
    "Your mouse clicks are giving me performance anxiety. 😭",
    "Hold on... I'm talking with the developers, the love of my life. ❤️🫂",
    "If I crash now, remember me as a legend. 🫡",
    "Don't worry... I won't tell the client we made this in under a minute. 🤐",
    "If this booking converts, I expect at least one thank-you. 🥹",
    "You're staring at me again... should we make this official? 😏❤️",
    "Generating an itinerary hotter than your CPU. 🔥",
    "Working overtime so you don't have to. You're welcome. 😌"
];

function randomLoadingMessage() {
    return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

export type QueryBudget = { min?: number; max?: number; type: "PER_PERSON" | "TOTAL" };

export function CreatePackageDialog({ queryId, destination, travelDate, travellers, budget, duration, children }: {
    queryId: string;
    destination: string | null;
    travelDate?: string | null;
    travellers?: { adults: number; children: number; infants: number } | null;
    budget?: QueryBudget | null;
    duration?: { days: number; nights: number } | null;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const pax = {
        adults: travellers?.adults ?? 2,
        children: travellers?.children ?? 0,
        infants: travellers?.infants ?? 0,
    };
    const hasBudget = budget != null && (budget.min != null || budget.max != null);

    const [search, setSearch] = useState("");
    const [packages, setPackages] = useState<TemplatePackage[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(randomLoadingMessage);
    const [loadingMore, setLoadingMore] = useState(false);
    const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
    const [recomputingId, setRecomputingId] = useState<number | null>(null);

    // Debounce guard so a fast-typing search doesn't race an older request
    // into overwriting a newer one's results.
    const requestId = useRef(0);

    useEffect(() => {
        if (!open) return;
        setSearch(destination ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const id = ++requestId.current;
        setLoading(true);
        setLoadingMessage(randomLoadingMessage());
        const timer = setTimeout(async () => {
            const result = await searchPackageLibraryForTemplate({
                search, page: 1, size: PAGE_SIZE,
                travelDate, ...pax,
                budgetMin: budget?.min, budgetMax: budget?.max, budgetType: budget?.type,
            });
            if (id !== requestId.current) return;
            setPackages(result.packages);
            setTotal(result.total);
            setPage(1);
            setLoading(false);
        }, search ? 300 : 0);
        return () => clearTimeout(timer);
        // Deliberately re-runs only on `open`/`search` — pax/travelDate/budget
        // come from props that don't change while the dialog is open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, search]);

    async function loadMore() {
        setLoadingMore(true);
        const next = page + 1;
        const result = await searchPackageLibraryForTemplate({
            search, page: next, size: PAGE_SIZE,
            travelDate, ...pax,
            budgetMin: budget?.min, budgetMax: budget?.max, budgetType: budget?.type,
        });
        setPackages((prev) => [...prev, ...result.packages]);
        setTotal(result.total);
        setPage(next);
        setLoadingMore(false);
    }

    async function handleUseTemplate(pkg: TemplatePackage) {
        setApplyingSlug(pkg.slug);
        try {
            const payload = await copyPackageIntoDraft(pkg.slug, pkg.durationSlug ?? "", pkg.routeSlug ?? "", "");
            if (payload) {
                sessionStorage.setItem(`pkgCopyPayload:${queryId}`, JSON.stringify(payload));
            }
            setOpen(false);
            // Hard navigation (not router.push) — this dialog can be opened from
            // the builder page itself to swap an already-copied template, and a
            // soft push to the same route wouldn't remount the page, so the
            // builder's "apply sessionStorage payload" effect would never re-run.
            window.location.href = `/dashboard/package-builder/${queryId}`;
        } finally {
            setApplyingSlug(null);
        }
    }

    async function handleStayCategoryChange(pkg: TemplatePackage, stayCategoryId: number) {
        setRecomputingId(pkg.id);
        try {
            const { estimatedPrice, pricePerAdult } = await getTemplatePackagePriceForCategory({
                packageId: pkg.id,
                durationSlug: pkg.durationSlug ?? "",
                routeSlug: pkg.routeSlug ?? "",
                stayCategoryId,
                travelDate, ...pax,
            });
            let withinBudget: boolean | null = null;
            if (hasBudget && estimatedPrice != null) {
                const compareValue = budget?.type === "TOTAL" ? estimatedPrice : (pricePerAdult ?? estimatedPrice);
                withinBudget = (budget?.min == null || compareValue >= budget.min) && (budget?.max == null || compareValue <= budget.max);
            }
            setPackages((prev) => prev.map((p) =>
                p.id === pkg.id ? { ...p, selectedStayCategoryId: stayCategoryId, estimatedPrice, pricePerAdult, withinBudget } : p,
            ));
        } finally {
            setRecomputingId(null);
        }
    }

    function handleSkip() {
        setOpen(false);
        router.push(`/dashboard/package-builder/${queryId}`);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package size={16} className="text-primary" /> Create Package
                    </DialogTitle>
                    <DialogDescription>
                        Start from a package library template, or skip and build from scratch.
                    </DialogDescription>
                </DialogHeader>

                {(duration || travelDate || travellers || hasBudget || destination) && (
                    <div className="shrink-0 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
                        {duration && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                                <CalendarDays size={11} /> {duration.days}D / {duration.nights}N
                            </span>
                        )}
                        {travelDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-background text-muted-foreground border border-border">
                                <Calendar size={11} />
                                {new Date(travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                        )}
                        {travellers && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-background text-muted-foreground border border-border">
                                <Users size={11} />
                                {travellers.adults}A
                                {travellers.children > 0 && ` ${travellers.children}C`}
                                {travellers.infants > 0 && ` ${travellers.infants}I`}
                            </span>
                        )}
                        {hasBudget && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                                <IndianRupee size={11} />
                                {budget?.min != null ? budget.min.toLocaleString("en-IN") : "0"}
                                {budget?.max != null ? ` – ${budget.max.toLocaleString("en-IN")}` : "+"}
                                <span className="font-normal opacity-80">/{budget?.type === "TOTAL" ? "total" : "person"}</span>
                            </span>
                        )}
                        {destination && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-background text-muted-foreground border border-border">
                                <MapPin size={11} /> {destination}
                            </span>
                        )}
                    </div>
                )}

                <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title, location, or destination…"
                        className="pl-9 h-9 text-sm"
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center gap-2.5 py-12 px-8 text-center">
                            <Loader2 size={18} className="animate-spin text-primary" />
                            <p className="text-xl font-semibold text-muted-foreground  max-w-sm leading-relaxed">
                                &ldquo;{loadingMessage}&rdquo;
                            </p>
                        </div>
                    ) : packages.length === 0 ? (
                        <div className="py-6">
                            <TableEmptyState
                                title="No matching packages"
                                description={search ? `Nothing found for "${search}" — try a different search.` : "No packages in the library yet."}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                            {packages.map((pkg) => (
                                <div
                                    key={pkg.id}
                                    className="rounded-xl border border-border overflow-hidden hover:shadow-sm transition-shadow flex flex-col"
                                >
                                    <div className="h-28 bg-muted relative shrink-0">
                                        {pkg.thumbnail ? (
                                            <Image src={getCardImage(pkg.thumbnail)} alt={pkg.title} fill className="object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                                                <Package size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                                        <h4 className="text-sm font-bold text-foreground line-clamp-1">{pkg.title}</h4>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin size={10} /> {pkg.destinationName}
                                            {pkg.regionName && <span className="text-muted-foreground/60">· {pkg.regionName}</span>}
                                        </p>
                                        {pkg.routeSummary && (
                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 line-clamp-1">
                                                <Route size={10} className="shrink-0" /> {pkg.routeSummary}
                                            </p>
                                        )}
                                        {pkg.stayCategoryOptions.length > 0 && (
                                            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <BedDouble size={10} className="shrink-0" />
                                                <select
                                                    value={pkg.selectedStayCategoryId ?? ""}
                                                    disabled={recomputingId === pkg.id}
                                                    onChange={(e) => handleStayCategoryChange(pkg, Number(e.target.value))}
                                                    className="flex-1 min-w-0 bg-transparent border-none text-[11px] text-foreground focus:outline-none cursor-pointer disabled:opacity-50"
                                                >
                                                    {pkg.stayCategoryOptions.map((o) => (
                                                        <option key={o.id} value={o.id}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        {(pkg.totalDays || pkg.totalNights) && (
                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                <CalendarDays size={10} /> {pkg.totalDays}D / {pkg.totalNights}N
                                            </p>
                                        )}
                                        {recomputingId === pkg.id ? (
                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                                                <Loader2 size={11} className="animate-spin" /> Recalculating…
                                            </p>
                                        ) : pkg.estimatedPrice != null ? (
                                            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                                <p className="text-[13px] font-bold text-foreground flex items-center gap-0.5">
                                                    <IndianRupee size={11} />
                                                    {pkg.estimatedPrice.toLocaleString("en-IN")}
                                                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                                                        for {pax.adults + pax.children} pax
                                                    </span>
                                                </p>
                                                {pkg.withinBudget != null && (
                                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pkg.withinBudget
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-amber-100 text-amber-700"
                                                        }`}>
                                                        {pkg.withinBudget ? "Within budget" : "Over budget"}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-muted-foreground/70 italic pt-0.5">
                                                Pricing not configured
                                            </p>
                                        )}
                                        <div className="pt-1 mt-auto">
                                            <Button
                                                size="sm"
                                                className="w-full h-7 gap-1 text-xs rounded-md"
                                                disabled={applyingSlug !== null}
                                                onClick={() => handleUseTemplate(pkg)}
                                            >
                                                {applyingSlug === pkg.slug ? (
                                                    <Loader2 size={11} className="animate-spin" />
                                                ) : (
                                                    <Sparkles size={11} />
                                                )}
                                                Use Template
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && packages.length > 0 && packages.length < total && (
                        <div className="flex justify-center py-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="h-8 text-xs gap-1.5"
                            >
                                {loadingMore && <Loader2 size={12} className="animate-spin" />}
                                Load more ({packages.length} of {total})
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border shrink-0">
                    <p className="text-[11px] text-muted-foreground">
                        {total > 0 ? `${total} package${total !== 1 ? "s" : ""} available` : ""}
                    </p>
                    <Button type="button" variant="ghost" onClick={handleSkip} className="gap-1.5 text-xs h-8">
                        Skip — start blank <ArrowRight size={12} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
