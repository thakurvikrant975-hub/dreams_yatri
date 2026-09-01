"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    Package, Search, MapPin, Route, BedDouble, CalendarDays, Loader2, Sparkles, ArrowRight, IndianRupee,
    Users, Calendar, Plus, X, Copy, BookOpen, SlidersHorizontal, ChevronDown, Radio, Clock, ExternalLink,
    Layers2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "../../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { TableEmptyState } from "../../components/dashboard/TableEmptyState";
import { getCardImage } from "@/app/lib/imageUrl";
import {
    searchPackageLibraryForTemplate, getTemplatePackagePriceForCategory, type TemplatePackage,
} from "../package-library/actions";
import {
    copyPackageIntoDraft, duplicateCustomPackageIntoDraft, type PackageCopyPayload,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import {
    getApprovedPackageTemplatesForLibrary, getPackageTemplateSnapshot, type ApprovedLibraryPackage,
} from "@/app/(dashboard)/dashboard/(main)/package-templates/actions";
import { emptyDay } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/day-mutations";
import { parseCalendarDay, formatCalendarDayLong } from "@/app/lib/dates/calendar-day";
import { cn } from "@/app/lib/utils";

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

/** Pulls the package slug out of a submitted packageUrl like
 * "/packages/kerala-highlights-family-escape/5d-4n/munnar-kochi/super-deluxe"
 * — the second path segment, right after "packages". Returns null for
 * anything that doesn't look like a package page path (old leads from
 * before packageUrl was tracked, non-package sources, etc). */
function parsePackageSlug(packageUrl: string | null | undefined): string | null {
    if (!packageUrl) return null;
    try {
        const path = packageUrl.startsWith("http") ? new URL(packageUrl).pathname : packageUrl;
        const parts = path.split("/").filter(Boolean);
        const idx = parts.indexOf("packages");
        return idx !== -1 ? (parts[idx + 1] ?? null) : null;
    } catch {
        return null;
    }
}

/** Two-letter initials for the small round avatar on "built by"/"submitted
 * by" lines — cheap standâ€‘in for a real photo, same idea as every other
 * avatar-less name badge in the dashboard. */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The staff-only preview of this catalog card's package — under
 * /dashboard/preview/packages, which works for offline (isActive false)
 * packages too (the real public page 404s those by design). Always returns
 * a URL, never null, so every catalog card gets a working "View" regardless
 * of how complete its setup is:
 *  - Full itinerary preview (/packages/<slug>/<duration>/<route>/<stay>-shaped)
 *    when a duration+route exist — a missing/unconfigured stay category no
 *    longer blocks this: that route's fetchPackagePageData call passes
 *    allowMissingStay, so a placeholder "default" segment resolves fine (a
 *    real data gap on plenty of packages — see that fetch's own comment).
 *  - The lightweight, itinerary-free preview (just the slug) for a package
 *    with no active duration/route at all — there's no itinerary to show
 *    without one, so the full page can't render either way. */
function catalogViewUrl(pkg: TemplatePackage): string {
    if (!pkg.durationSlug || !pkg.routeSlug) return `/dashboard/preview/packages/${pkg.slug}`;
    const staySlug = pkg.stayCategoryOptions.find((o) => o.id === pkg.selectedStayCategoryId)?.slug
        ?? pkg.stayCategoryOptions[0]?.slug
        ?? "default";
    return `/dashboard/preview/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${staySlug}`;
}

export type QueryBudget = { min?: number; max?: number; type: "PER_PERSON" | "TOTAL" };

function newPackageId(): string {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `pkg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type ExistingPackageOption = {
    id: string;
    title: string;
    status: string;
    builtByName?: string | null;
    /** Optional — older/other callers may not select these, so the "Copy
     * Existing" card degrades gracefully (no image/route/price line) rather
     * than requiring them. See SentPackageInfo in package-status.ts, which is
     * what actually feeds this in practice. */
    coverImage?: string | null;
    destination?: string | null;
    totalDays?: number | null;
    totalNights?: number | null;
    stops?: { name: string; nights: number }[];
    createdAt?: Date | string | null;
    totalPrice?: number | null;
    pricePerPerson?: number | null;
};

export function CreatePackageDialog({ queryId, packageId, existingPackages, destination, packageUrl, travelDate, travellers, budget, duration, queryReceivedAt, builderBasePath = "/dashboard/package-builder", children }: {
    /** Query to attach a brand-new package to — pass this from a "Create
     * Package" entry point (Sales Query table/sheet) where no package
     * exists yet. Exactly one of queryId/packageId should be given. */
    /** Which builder to land in. Defaults to v1, which is still where the
     * sales team works by default while they are being moved onto v2 one
     * person at a time. Each builder passes its own path, so changing a
     * template never throws an exec out of the one they are working in. */
    builderBasePath?: string;
    queryId?: string;
    /** An already-existing package's own id — pass this from inside the
     * builder itself ("Change Template" on the current draft), which swaps
     * this dialog's copy-into-draft behavior in place instead of creating
     * a new package. */
    packageId?: string;
    /** This query's other packages already built (newest first) — only
     * meaningful alongside queryId (the "add another package" entry point).
     * Lets the exec duplicate an existing one instead of starting over,
     * e.g. a second budget option for the same client. See
     * duplicateCustomPackageIntoDraft. */
    existingPackages?: ExistingPackageOption[];
    destination: string | null;
    /** The exact public package page path this lead submitted their query
     * from, if any — used to reliably surface the originating package first,
     * instead of guessing from destination name alone. */
    packageUrl?: string | null;
    travelDate?: string | null;
    travellers?: { adults: number; children: number; infants: number } | null;
    budget?: QueryBudget | null;
    duration?: { days: number; nights: number } | null;
    /** When the customer's query itself came in — shown on the matching
     * template's card so the exec can see how fresh the lead is at a glance. */
    queryReceivedAt?: Date | string | null;
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const querySlug = parsePackageSlug(packageUrl);
    const hasExisting = !!existingPackages && existingPackages.length > 0;

    const pax = {
        adults: travellers?.adults ?? 2,
        children: travellers?.children ?? 0,
        infants: travellers?.infants ?? 0,
    };
    const hasBudget = budget != null && (budget.min != null || budget.max != null);

    const [activeTab, setActiveTab] = useState<"browse" | "copy">("browse");
    const [search, setSearch] = useState("");
    // Route search: sales exec keys in the stops of the itinerary ("Munnar",
    // "Alleppey", "Kovalam", …) instead of a free-text query, and we look
    // for a catalog package whose route covers every one of them.
    const [routeMode, setRouteMode] = useState(false);
    const [routeStops, setRouteStops] = useState<string[]>(["", ""]);
    const cleanRouteStops = routeStops.map((s) => s.trim()).filter(Boolean);
    const routeStopsKey = routeStops.join("|");

    // Lightweight client-side refinements over whatever page of results is
    // already fetched — narrower than a real query so they don't need a
    // server round-trip, and reset every time the dialog reopens.
    const [filterOpen, setFilterOpen] = useState(false);
    const [onlyWithinBudget, setOnlyWithinBudget] = useState(false);
    const [onlyLive, setOnlyLive] = useState(false);
    const [onlyDurationMatch, setOnlyDurationMatch] = useState(false);
    const activeFilterCount = [onlyWithinBudget, onlyLive, onlyDurationMatch].filter(Boolean).length;

    const [packages, setPackages] = useState<TemplatePackage[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(randomLoadingMessage);
    const [loadingMore, setLoadingMore] = useState(false);
    const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
    const [applyingDuplicateId, setApplyingDuplicateId] = useState<string | null>(null);
    const [recomputingId, setRecomputingId] = useState<number | null>(null);

    // The approved package library (/dashboard/package-templates) — a
    // separate, unrelated source from the catalog `packages` grid above, so
    // fetched once per open rather than folded into the debounced catalog
    // search. Only offered from a "Create Package" entry point (queryId, no
    // packageId) — swapping an in-progress draft's template in place would
    // need a different apply path than the fresh-draft one below.
    const [libraryPackages, setLibraryPackages] = useState<ApprovedLibraryPackage[]>([]);
    const [applyingLibraryId, setApplyingLibraryId] = useState<string | null>(null);

    // Debounce guard so a fast-typing search doesn't race an older request
    // into overwriting a newer one's results.
    const requestId = useRef(0);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setSearch(destination ?? "");
        setRouteMode(false);
        setRouteStops(["", ""]);
        setActiveTab(hasExisting ? "browse" : "copy");
        setFilterOpen(false);
        setOnlyWithinBudget(false);
        setOnlyLive(false);
        setOnlyDurationMatch(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open || queryId == null || packageId != null) return;
        getApprovedPackageTemplatesForLibrary().then(setLibraryPackages);
    }, [open, queryId, packageId]);

    const filteredLibraryPackages = libraryPackages.filter((p) => {
        if (routeMode || !search) return true;
        const s = search.toLowerCase();
        return p.title.toLowerCase().includes(s) || (p.destination ?? "").toLowerCase().includes(s);
    });

    useEffect(() => {
        if (!open) return;
        const id = ++requestId.current;
        setLoading(true);
        setLoadingMessage(randomLoadingMessage());
        const timer = setTimeout(async () => {
            const result = await searchPackageLibraryForTemplate({
                search: routeMode ? "" : search, page: 1, size: PAGE_SIZE,
                routeStops: routeMode ? cleanRouteStops : undefined,
                travelDate, ...pax,
                budgetMin: budget?.min, budgetMax: budget?.max, budgetType: budget?.type,
                queryDestination: destination ?? undefined,
                querySlug: querySlug ?? undefined,
                targetDuration: duration ?? undefined,
            });
            if (id !== requestId.current) return;
            setPackages(result.packages);
            setTotal(result.total);
            setPage(1);
            setLoading(false);
        }, search || routeMode ? 300 : 0);
        return () => clearTimeout(timer);
        // Deliberately re-runs only on `open`/`search`/route state — pax/travelDate/budget
        // come from props that don't change while the dialog is open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, search, routeMode, routeStopsKey]);

    async function loadMore() {
        setLoadingMore(true);
        const next = page + 1;
        const result = await searchPackageLibraryForTemplate({
            search: routeMode ? "" : search, page: next, size: PAGE_SIZE,
            routeStops: routeMode ? cleanRouteStops : undefined,
            travelDate, ...pax,
            budgetMin: budget?.min, budgetMax: budget?.max, budgetType: budget?.type,
            queryDestination: destination ?? undefined,
            querySlug: querySlug ?? undefined,
            targetDuration: duration ?? undefined,
        });
        setPackages((prev) => [...prev, ...result.packages]);
        setTotal(result.total);
        setPage(next);
        setLoadingMore(false);
    }

    // Auto-fetch the next page once the sentinel at the bottom of the grid
    // scrolls into view — the visible "Load more" button underneath stays as
    // a fallback/affordance for anyone who prefers clicking (and for when
    // the observer's viewport is the whole page rather than this scroll
    // container in some embeds).
    const canLoadMore = !loading && packages.length > 0 && packages.length < total;
    useEffect(() => {
        if (!open || activeTab !== "browse" || !canLoadMore || loadingMore) return;
        const el = loadMoreRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
            { rootMargin: "200px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, activeTab, canLoadMore, loadingMore, page]);

    // Reuses the existing draft's id when swapping its template in place
    // ("Change Template", packageId given); mints a fresh one when this is
    // creating a brand-new package for a query — the builder lazily
    // persists it on the first Save, same as starting fully blank.
    function targetUrl(id: string): string {
        return queryId && !packageId
            ? `${builderBasePath}/${id}?fromQuery=${queryId}`
            : `${builderBasePath}/${id}`;
    }

    async function handleUseTemplate(pkg: TemplatePackage) {
        setApplyingSlug(pkg.slug);
        try {
            const payload = await copyPackageIntoDraft(pkg.slug, pkg.durationSlug ?? "", pkg.routeSlug ?? "", "");
            // A null payload means the template's package/duration/route
            // couldn't be resolved at all (e.g. slug mismatch) — previously
            // this silently navigated to a completely empty draft with no
            // indication anything went wrong. Stay put and say so instead.
            if (!payload) {
                toast.error(`Couldn't load "${pkg.title}" as a template — try again or pick a different package.`);
                return;
            }
            const targetId = packageId ?? newPackageId();
            sessionStorage.setItem(`pkgCopyPayload:${targetId}`, JSON.stringify(payload));
            setOpen(false);
            // Hard navigation (not router.push) — this dialog can be opened from
            // the builder page itself to swap an already-copied template, and a
            // soft push to the same route wouldn't remount the page, so the
            // builder's "apply sessionStorage payload" effect would never re-run.
            window.location.href = targetUrl(targetId);
        } finally {
            setApplyingSlug(null);
        }
    }

    // Same sessionStorage + hard-navigation flow as handleUseTemplate, just
    // built from a PackageTemplate's flat snapshot instead of a catalog
    // package's route/duration/stay data — there's no live pricing or
    // hotel_room_pricing links to resolve here, so the payload is a pure,
    // synchronous mapping rather than a server round-trip through
    // fetchPackagePageData.
    async function handleUseLibraryTemplate(pkg: ApprovedLibraryPackage) {
        setApplyingLibraryId(pkg.id);
        try {
            const snapshot = await getPackageTemplateSnapshot(pkg.id);
            if (!snapshot) {
                toast.error(`Couldn't load "${pkg.title}" — try again or pick a different package.`);
                return;
            }
            const payload: PackageCopyPayload = {
                title: pkg.title,
                description: pkg.description ?? "",
                coverImage: pkg.coverImage ?? "",
                destination: pkg.destination ?? "",
                startingPoint: "",
                totalDays: pkg.totalDays,
                totalNights: pkg.totalNights,
                inclusions: snapshot.inclusions,
                exclusions: snapshot.exclusions,
                termsNotes: snapshot.termsNotes ?? "",
                stops: snapshot.stops.map((s) => ({ name: s.name, nights: s.nights })),
                itineraries: snapshot.days.map((d) => ({
                    ...emptyDay(d.day),
                    title: d.title,
                    description: d.description ?? "",
                    meals: d.meals,
                    extraMeals: d.extraMeals,
                    accommodation: d.accommodation ?? "",
                    accommodationLocation: d.accommodationLocation ?? "",
                    accommodationStarRating: d.accommodationStarRating ?? "",
                    accommodationRoomSpecs: d.accommodationRoomSpecs ?? "",
                    transport: d.transport ?? "",
                    transportVehicleType: d.transportVehicleType ?? "",
                    transportSeats: d.transportSeats,
                    extraCabs: d.extraCabs,
                    notes: d.notes ?? "",
                    notesTitle: d.notesTitle,
                    notesType: d.notesType,
                    activities: d.activities.map((a) => ({
                        title: a.title, description: a.description ?? "",
                        photo: a.photo ?? "", photos: a.photos, photoLabels: a.photoLabels,
                    })),
                })),
            };
            const targetId = packageId ?? newPackageId();
            sessionStorage.setItem(`pkgCopyPayload:${targetId}`, JSON.stringify(payload));
            setOpen(false);
            window.location.href = targetUrl(targetId);
        } finally {
            setApplyingLibraryId(null);
        }
    }

    async function handleDuplicate(pkg: ExistingPackageOption) {
        setApplyingDuplicateId(pkg.id);
        try {
            const payload = await duplicateCustomPackageIntoDraft(pkg.id);
            if (!payload) {
                toast.error(`Couldn't load "${pkg.title}" to duplicate — try again.`);
                return;
            }
            const targetId = packageId ?? newPackageId();
            sessionStorage.setItem(`pkgCopyPayload:${targetId}`, JSON.stringify(payload));
            setOpen(false);
            // Hard navigation — same reasoning as handleUseTemplate above.
            window.location.href = targetUrl(targetId);
        } finally {
            setApplyingDuplicateId(null);
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
        // "Change Template" mode — already inside the builder editing this
        // exact package, so there's nothing to create; just close.
        if (packageId) return;
        router.push(targetUrl(newPackageId()));
    }

    function clearFilters() {
        setOnlyWithinBudget(false);
        setOnlyLive(false);
        setOnlyDurationMatch(false);
    }

    const visiblePackages = useMemo(() => packages.filter((pkg) => {
        if (onlyWithinBudget && pkg.withinBudget !== true) return false;
        if (onlyLive && !pkg.isActive) return false;
        if (onlyDurationMatch && !(duration && pkg.totalDays === duration.days && pkg.totalNights === duration.nights)) return false;
        return true;
    }), [packages, onlyWithinBudget, onlyLive, onlyDurationMatch, duration]);

    const contextChips = (duration || travelDate || travellers || hasBudget || destination) && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
            {duration && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                    <CalendarDays size={11} /> {duration.days}D / {duration.nights}N
                </span>
            )}
            {travelDate && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-background text-muted-foreground border border-border">
                    <Calendar size={11} />
                    {formatCalendarDayLong(parseCalendarDay(travelDate))}
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
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent
                className="p-0 gap-0 w-[calc(100vw-1rem)] sm:w-full max-w-full sm:max-w-5xl h-[calc(100vh-1rem)] sm:h-[85vh] max-h-[calc(100vh-1rem)] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="shrink-0 gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border">
                    <div>
                        <DialogTitle className="flex items-center gap-2 text-sm">
                            <Package size={16} className="text-primary" /> Create Package
                        </DialogTitle>
                        <DialogDescription className="mt-0.5">
                            {hasExisting
                                ? "Duplicate an existing package for this client, or start fresh from a template."
                                : "Start from a package library template, or skip and build from scratch."}
                        </DialogDescription>
                    </div>

                    {contextChips}

                    {hasExisting && (
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "copy")}>
                            <TabsList variant="line" className="w-full justify-start p-0 gap-4 bg-transparent">
                                <TabsTrigger value="browse" className="flex-none px-1 py-2 gap-1.5">
                                    <Sparkles size={13} /> Browse Templates
                                </TabsTrigger>
                                <TabsTrigger value="copy" className="flex-none px-1 py-2 gap-1.5">
                                    <Layers2 size={13} /> Copy Existing
                                    <span className="ml-1 inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                                        {existingPackages!.length}
                                    </span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </DialogHeader>

                {/* ── Copy Existing ─────────────────────────────────────────────── */}
                {hasExisting && activeTab === "copy" && (
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4">
                        <p className="text-xs text-muted-foreground mb-3">
                            Copies the itinerary, hotels/cabs, tickets and add-ons into a new draft for this client.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {existingPackages!.map((pkg) => {
                                const price = pkg.totalPrice ?? pkg.pricePerPerson ?? null;
                                const stops = pkg.stops ?? [];
                                return (
                                    <div
                                        key={pkg.id}
                                        className="group rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all flex flex-col bg-card"
                                    >
                                        <div className="h-32 bg-muted relative shrink-0 overflow-hidden">
                                            {pkg.coverImage ? (
                                                <Image src={getCardImage(pkg.coverImage)} alt={pkg.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                                                    <Package size={22} />
                                                </div>
                                            )}
                                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 uppercase tracking-wide">
                                                {pkg.status}
                                            </span>
                                        </div>
                                        <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                                            <h4 className="text-sm font-bold text-foreground line-clamp-1">{pkg.title}</h4>
                                            {pkg.destination && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <MapPin size={10} /> {pkg.destination}
                                                </p>
                                            )}
                                            {stops.length > 0 && (
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 line-clamp-1">
                                                    <Route size={10} className="shrink-0" />
                                                    {stops.map((s) => `${s.name} (${s.nights}N)`).join(" → ")}
                                                </p>
                                            )}
                                            {(pkg.totalDays || pkg.totalNights) && (
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <CalendarDays size={10} /> {pkg.totalDays}D / {pkg.totalNights}N
                                                </p>
                                            )}
                                            {pkg.createdAt && (
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Clock size={10} /> Created {formatDistanceToNow(new Date(pkg.createdAt), { addSuffix: true })}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between gap-1.5 pt-0.5">
                                                {pkg.builtByName ? (
                                                    <span className="flex items-center gap-1.5 min-w-0">
                                                        <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[8px] font-bold">
                                                            {initials(pkg.builtByName)}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground truncate">by {pkg.builtByName}</span>
                                                    </span>
                                                ) : <span />}
                                                {price != null && (
                                                    <span className="text-[12px] font-bold text-foreground flex items-center gap-0.5 shrink-0">
                                                        <IndianRupee size={10} />{price.toLocaleString("en-IN")}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="pt-1 mt-auto flex items-center gap-1.5">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 cursor-pointer gap-1 text-xs rounded-md px-2.5"
                                                    title="Open this package in a new tab"
                                                    onClick={() => window.open(`${builderBasePath}/${pkg.id}`, "_blank", "noopener,noreferrer")}
                                                >
                                                    <ExternalLink size={11} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="flex-1 h-7 gap-1 text-xs rounded-md"
                                                    disabled={applyingDuplicateId !== null}
                                                    onClick={() => handleDuplicate(pkg)}
                                                >
                                                    {applyingDuplicateId === pkg.id ? (
                                                        <Loader2 size={11} className="animate-spin" />
                                                    ) : (
                                                        <Copy size={11} />
                                                    )}
                                                    Duplicate
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Browse Templates ──────────────────────────────────────────── */}
                {(!hasExisting || activeTab === "browse") && (
                    <>
                        <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2 space-y-2 border-b border-border">
                            {routeMode ? (
                                <div className="space-y-1.5">
                                    {routeStops.map((stop, idx) => (
                                        <div key={idx} className="relative flex items-center gap-1.5">
                                            <Route className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                value={stop}
                                                onChange={(e) => setRouteStops((prev) =>
                                                    prev.map((s, i) => (i === idx ? e.target.value : s)),
                                                )}
                                                placeholder={`Destination ${idx + 1}`}
                                                className="pl-9 h-9 text-sm"
                                            />
                                            {routeStops.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRouteStops((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    aria-label={`Remove destination ${idx + 1}`}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setRouteStops((prev) => [...prev, ""])}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                        >
                                            <Plus size={12} /> Add destination
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRouteMode(false)}
                                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                        >
                                            Back to keyword search
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1 min-w-0">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by title, location, or destination…"
                                            className="pl-9 pr-3 h-9 text-sm"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setRouteMode(true)}
                                        className="hidden sm:inline-flex shrink-0 h-9 items-center gap-1 px-2.5 text-xs font-medium text-primary hover:underline"
                                    >
                                        <Route size={12} /> By route
                                    </button>
                                    <div className="relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setFilterOpen((o) => !o)}
                                            aria-expanded={filterOpen}
                                            className={cn(
                                                "h-9 px-3 flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer",
                                                "border-border bg-background text-muted-foreground hover:bg-muted",
                                                (filterOpen || activeFilterCount > 0) && "border-primary/50 bg-primary/5 text-primary",
                                            )}
                                        >
                                            <SlidersHorizontal size={13} />
                                            <span className="hidden sm:inline">Filters</span>
                                            {activeFilterCount > 0 && (
                                                <span className="min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-semibold rounded-full bg-primary text-primary-foreground tabular-nums">
                                                    {activeFilterCount}
                                                </span>
                                            )}
                                            <ChevronDown size={12} className={cn("transition-transform", filterOpen && "rotate-180")} />
                                        </button>

                                        {filterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                                                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-border bg-popover p-3 shadow-lg space-y-2.5">
                                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Refine results</p>
                                                    <label className="flex items-center justify-between gap-2 text-xs cursor-pointer py-1">
                                                        <span className="flex items-center gap-1.5"><IndianRupee size={12} className="text-muted-foreground" /> Within budget only</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={onlyWithinBudget}
                                                            disabled={!hasBudget}
                                                            onChange={(e) => setOnlyWithinBudget(e.target.checked)}
                                                            className="h-3.5 w-3.5 accent-primary disabled:opacity-40"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-2 text-xs cursor-pointer py-1">
                                                        <span className="flex items-center gap-1.5"><Radio size={12} className="text-muted-foreground" /> Live packages only</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={onlyLive}
                                                            onChange={(e) => setOnlyLive(e.target.checked)}
                                                            className="h-3.5 w-3.5 accent-primary"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between gap-2 text-xs cursor-pointer py-1">
                                                        <span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-muted-foreground" /> Matches requested duration</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={onlyDurationMatch}
                                                            disabled={!duration}
                                                            onChange={(e) => setOnlyDurationMatch(e.target.checked)}
                                                            className="h-3.5 w-3.5 accent-primary disabled:opacity-40"
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRouteMode(true)}
                                                        className="sm:hidden w-full flex items-center gap-1.5 text-xs font-medium text-primary pt-1 border-t border-border"
                                                    >
                                                        <Route size={12} /> Search by route instead
                                                    </button>
                                                    {activeFilterCount > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={clearFilters}
                                                            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground pt-1 border-t border-border"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3">
                            {filteredLibraryPackages.length > 0 && (
                                <div className="pb-4 mb-4 border-b border-border space-y-2">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                                        <BookOpen size={13} /> From your team&apos;s library
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {filteredLibraryPackages.map((pkg) => (
                                            <div key={pkg.id} className="group rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all flex flex-col bg-card">
                                                <div className="h-32 bg-muted relative shrink-0 overflow-hidden">
                                                    {pkg.coverImage ? (
                                                        <Image src={getCardImage(pkg.coverImage)} alt={pkg.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                                                            <BookOpen size={22} />
                                                        </div>
                                                    )}
                                                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5">
                                                        <BookOpen size={9} /> Library
                                                    </span>
                                                </div>
                                                <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                                                    <h4 className="text-sm font-bold text-foreground line-clamp-1">{pkg.title}</h4>
                                                    {pkg.destination && (
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <MapPin size={10} /> {pkg.destination}
                                                        </p>
                                                    )}
                                                    {pkg.stops.length > 0 && (
                                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 line-clamp-1">
                                                            <Route size={10} className="shrink-0" />
                                                            {pkg.stops.map((s) => `${s.name} (${s.nights}N)`).join(" → ")}
                                                        </p>
                                                    )}
                                                    {(pkg.totalDays || pkg.totalNights) && (
                                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                            <CalendarDays size={10} /> {pkg.totalDays}D / {pkg.totalNights}N
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-1.5 pt-0.5">
                                                        <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[8px] font-bold">
                                                            {initials(pkg.submittedByName)}
                                                        </span>
                                                        <p className="text-[11px] text-muted-foreground truncate">by {pkg.submittedByName}</p>
                                                    </div>
                                                    <div className="pt-1.5 mt-auto flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 gap-1 text-xs rounded-md px-2.5"
                                                            title="View this template in a new tab"
                                                            onClick={() => window.open(`/dashboard/package-templates?view=${pkg.id}`, "_blank", "noopener,noreferrer")}
                                                        >
                                                            <ExternalLink size={11} />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 h-7 gap-1 text-xs rounded-md"
                                                            disabled={applyingLibraryId !== null}
                                                            onClick={() => handleUseLibraryTemplate(pkg)}
                                                        >
                                                            {applyingLibraryId === pkg.id ? (
                                                                <Loader2 size={11} className="animate-spin" />
                                                            ) : (
                                                                <BookOpen size={11} />
                                                            )}
                                                            Use Template
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loading ? (
                                <div className="flex flex-col items-center justify-center gap-2.5 py-16 px-8 text-center">
                                    <Loader2 size={18} className="animate-spin text-primary" />
                                    <p className="text-sm font-medium text-muted-foreground max-w-sm leading-relaxed">
                                        &ldquo;{loadingMessage}&rdquo;
                                    </p>
                                </div>
                            ) : packages.length === 0 ? (
                                <div className="py-6">
                                    <TableEmptyState
                                        title="No matching packages"
                                        description={
                                            routeMode && cleanRouteStops.length > 0
                                                ? `No package covers ${cleanRouteStops.join(", ")} — try fewer stops.`
                                                : search
                                                    ? `Nothing found for "${search}" — try a different search.`
                                                    : "No packages in the library yet."
                                        }
                                    />
                                </div>
                            ) : visiblePackages.length === 0 ? (
                                <div className="py-6 flex flex-col items-center gap-3">
                                    <TableEmptyState
                                        title="No packages match your filters"
                                        description={`${packages.length} package${packages.length === 1 ? "" : "s"} found, but none match the current filters.`}
                                    />
                                    <Button size="sm" variant="outline" onClick={clearFilters} className="h-7 text-xs">Clear filters</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-1">
                                    {visiblePackages.map((pkg, idx) => {
                                        // Prefer the exact originating package (by slug); only fall
                                        // back to a same-destination guess for older leads/sources
                                        // that never captured a packageUrl.
                                        const isQueryMatch = idx === 0 && (
                                            querySlug
                                                ? pkg.slug === querySlug
                                                : !!destination && pkg.destinationName.trim().toLowerCase() === destination.trim().toLowerCase()
                                        );
                                        // The sort already pins these near the top (see
                                        // searchPackageLibraryForTemplate's isDurationMatch
                                        // tier) — this just makes it visually obvious why.
                                        const isDurationMatch = !!duration
                                            && pkg.totalDays === duration.days
                                            && pkg.totalNights === duration.nights;
                                        return (
                                        <div
                                            key={pkg.id}
                                            className={cn(
                                                "group rounded-xl overflow-hidden transition-all flex flex-col bg-card",
                                                isQueryMatch
                                                    ? "border-2 border-amber-400 shadow-sm"
                                                    : isDurationMatch
                                                        ? "border-2 border-emerald-400 shadow-sm"
                                                        : "border border-border hover:shadow-md hover:border-primary/30",
                                            )}
                                        >
                                            <div className="h-32 bg-muted relative shrink-0 overflow-hidden">
                                                {pkg.thumbnail ? (
                                                    <Image src={getCardImage(pkg.thumbnail)} alt={pkg.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                                                        <Package size={22} />
                                                    </div>
                                                )}
                                                {isQueryMatch && queryReceivedAt && (
                                                    <span className="absolute top-1.5 right-1.5 z-10 rounded-full bg-amber-400 text-amber-950 text-[9px] font-semibold px-2 py-0.5 shadow-sm">
                                                        Query received {new Date(queryReceivedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                    </span>
                                                )}
                                                <span className={cn(
                                                    "absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                                                    pkg.isActive ? "bg-emerald-500/90 text-white" : "bg-black/55 text-white",
                                                )}>
                                                    <span className={cn("size-1.5 rounded-full", pkg.isActive ? "bg-white" : "bg-white/50")} />
                                                    {pkg.isActive ? "Live" : "Not Live"}
                                                </span>
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
                                                    <p className={isDurationMatch ? "text-[11px] font-semibold text-emerald-700 flex items-center gap-1" : "text-[11px] text-muted-foreground flex items-center gap-1"}>
                                                        <CalendarDays size={10} /> {pkg.totalDays}D / {pkg.totalNights}N
                                                        {isDurationMatch && <span className="text-emerald-600">— matches request</span>}
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
                                                            <span className={cn(
                                                                "text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                                                                pkg.withinBudget ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                                                            )}>
                                                                {pkg.withinBudget ? "Within budget" : "Over budget"}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-muted-foreground/70 italic pt-0.5">
                                                        Pricing not configured
                                                    </p>
                                                )}
                                                <div className="pt-1 mt-auto flex items-center gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 gap-1 text-xs rounded-md px-2.5"
                                                        title="Preview this package in a new tab"
                                                        onClick={() => window.open(catalogViewUrl(pkg), "_blank", "noopener,noreferrer")}
                                                    >
                                                        <ExternalLink size={11} />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="flex-1 h-7 gap-1 text-xs rounded-md"
                                                        disabled={applyingSlug !== null || applyingDuplicateId !== null}
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
                                        );
                                    })}
                                </div>
                            )}

                            {!loading && packages.length > 0 && packages.length < total && (
                                <div ref={loadMoreRef} className="flex justify-center py-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                        className="h-8 text-xs gap-1.5"
                                    >
                                        {loadingMore && <Loader2 size={12} className="animate-spin" />}
                                        {loadingMore ? "Loading more…" : `Load more (${packages.length} of ${total})`}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-border shrink-0">
                    <p className="text-[11px] text-muted-foreground">
                        {activeTab === "browse" && total > 0 ? `${total} package${total !== 1 ? "s" : ""} available` : ""}
                    </p>
                    <Button type="button" variant="ghost" onClick={handleSkip} className="gap-1.5 text-xs h-8">
                        {packageId ? "Cancel" : "Skip — start blank"} <ArrowRight size={12} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
