/**
 * Deep-clone a real holiday package and hotel into ₹1 test copies.
 *
 * Unlike the bare-bones SKUs from seed-test-payment-skus.ts, these carry real
 * itinerary content — multi-day stays, activities, cabs, permits, images — so a
 * test booking exercises the whole ops chain (booking → per-day hotel legs →
 * verify-hotels → hotel-requests) the way a genuine one does.
 *
 * WHY A DEEP CLONE. A package has no price of its own; the quote engine derives
 * it from shared rows — hotel_room_pricing, cab_pricing, activity_variant_pricing.
 * A shallow clone would point at the live rows every real package uses, so
 * pricing it at ₹1 would mean editing real inventory. Everything that carries a
 * price is therefore duplicated, and the clone references only its own copies.
 *
 * HOW IT LANDS ON EXACTLY ₹1. The engine sums every component subtotal and
 * rounds ONCE, at the end:
 *
 *     base_cost = Math.ceil(hotel + meals + activities + cabs + permits)
 *
 * so per-component fractions are fine — only the total matters, and any total in
 * (0, 1] becomes ₹1. The budget below is sized so a typical 2-adult booking stays
 * under ₹1.00. Note the multipliers: hotel is per-night × rooms, cabs per-day,
 * activities per-person — a flat fraction each does NOT sum to their face values.
 * margin and GST are 0%, since each rounds up independently and would otherwise
 * add ₹1 apiece.
 *
 * Every created row id is recorded to the manifest so teardown-test-clone.ts can
 * delete exactly this and nothing else.
 *
 * Run:  npm run clone:test-skus                    (dry run)
 *       npm run clone:test-skus -- --commit
 *       npm run clone:test-skus -- --commit --source-package=<slug>
 */
import { db, dbTarget } from "./_db";
import { ManifestWriter, type ClonedModel } from "./test-clone-registry";

const COMMIT = process.argv.includes("--commit");
const argOf = (name: string) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

/** Per-unit rupee costs. Kept well under ₹1.00 in total once multiplied out. */
const BUDGET = {
    hotelPerNight: 0.02,
    mealPerPersonPerMeal: 0.01,
    activityPerPerson: 0.01,
    cabPerDay: 0.01,
    permitFlat: 0.01,
} as const;

const TAG = "[TEST CLONE]";
const SLUG_PREFIX = "test-clone-";

/**
 * Only hotels.slug and packages.slug are globally unique (duration/route/stay
 * slugs are scoped to their parent), so those two carry a per-run suffix. Without
 * it a second clone — or a retry after a partial failure — collides on the first
 * hotel and aborts.
 */
const RUN_ID = Date.now().toString(36).slice(-4);
const uniqueSlug = (slug: string) => `${SLUG_PREFIX}${slug}-${RUN_ID}`.slice(0, 190);

/**
 * Relation keys this script pulls in via `include`. They must be stripped before
 * re-creating a row: Prisma rejects nested relation payloads in an unchecked
 * create, and an EMPTY relation array is indistinguishable by value from an empty
 * scalar list (inclusions[], active_meals[]), so naming them is the only exact
 * way to tell the two apart.
 */
const REL = {
    hotels: ["hotelRooms", "meal_pricing"],
    hotel_rooms: ["pricing"],
    activity_variants: ["pricing"],
    packages: ["images", "durations", "stay_categories", "packagePricings", "itineraries"],
    package_durations: ["routes", "permits", "cabTypes"],
    package_routes: ["stops"],
    package_cab_types: ["segments"],
    package_itineraries: ["itineraryStays", "itinerary_activities", "itinerary_attractions", "itinerary_transfers"],
    itinerary_stays: ["room_pricing"],
    itinerary_activities: ["variant"],
} as const;

let manifest: ManifestWriter;

function note(msg: string) {
    console.log(`${COMMIT ? "  ✓" : "  ·"} ${msg}`);
}

/**
 * Strip the columns that must never be copied verbatim: the primary key, and
 * anything Prisma exposes as a nested relation object rather than a scalar.
 * Reading whole rows and subtracting is far more robust than enumerating every
 * column — these models carry 20+ fields each and gain more over time.
 */
function scalarsOf<T extends Record<string, unknown>>(row: T, drop: string[] = []): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
        if (k === "id" || drop.includes(k)) continue;
        if (v === null || v === undefined) { out[k] = v; continue; }
        if (v instanceof Date) { out[k] = v; continue; }
        // Scalar lists (inclusions[], active_meals[], meals[]) must be copied, but
        // a to-many relation is an array too — tell them apart by element type,
        // since Prisma rejects nested relation objects in an unchecked create.
        if (Array.isArray(v)) {
            if (v.every((x) => x === null || typeof x !== "object")) out[k] = v;
            continue;
        }
        // Decimal and BigInt are objects but are genuine scalar values.
        if (typeof v === "object") {
            const ctor = (v as { constructor?: { name?: string } }).constructor?.name;
            if (ctor === "Decimal" || ctor === "BigInt") out[k] = v;
            continue;
        }
        out[k] = v;
    }
    return out;
}

/** Create + record in one step so nothing can be created without being tracked. */
async function track<T extends { id: string | number }>(model: ClonedModel, created: T): Promise<T> {
    manifest.add(model, created.id);
    return created;
}

async function main() {
    console.log(
        COMMIT
            ? "\n▸ Cloning real SKUs into ₹1 test copies (COMMIT)"
            : "\n▸ Cloning real SKUs into ₹1 test copies (DRY RUN — pass --commit to apply)",
    );
    console.log(`  target: ${dbTarget}\n`);

    // ── Pick a source package: a real one with a full itinerary, so the clone
    // actually exercises the ops chain rather than being another empty shell. ──
    const wantPkg = argOf("source-package");
    const source = await db.packages.findFirst({
        where: {
            ...(wantPkg ? { slug: wantPkg } : { is_active: true, slug: { not: { startsWith: SLUG_PREFIX } } }),
            itineraries: { some: { itineraryStays: { some: {} } } },
        },
        orderBy: { id: "asc" },
        include: {
            images: true,
            durations: { include: { routes: { include: { stops: true } }, permits: true, cabTypes: { include: { segments: true } } } },
            stay_categories: true,
            packagePricings: true,
            itineraries: {
                include: {
                    itineraryStays: { include: { room_pricing: { include: { room: true, hotel: true, occupancy_prices: true } } } },
                    itinerary_activities: { include: { variant: { include: { pricing: true } } } },
                    itinerary_attractions: true,
                    itinerary_transfers: true,
                },
            },
        },
    });

    if (!source) {
        throw new Error(
            wantPkg
                ? `Package '${wantPkg}' not found, or it has no itinerary stays to clone.`
                : "No active package with itinerary stays found to clone from.",
        );
    }

    const nights = source.itineraries.reduce(
        (n, i) => n + i.itineraryStays.reduce((m, s) => m + s.num_nights, 0), 0,
    );
    const days = source.itineraries.length;
    const hotelIds = [...new Set(source.itineraries.flatMap((i) => i.itineraryStays.map((s) => s.room_pricing.hotel.id)))];
    const activityVariantIds = [...new Set(source.itineraries.flatMap((i) => i.itinerary_activities.map((a) => a.variant?.id).filter((x): x is number => x != null)))];
    const cabPricingIds = [...new Set(source.durations.flatMap((d) => d.cabTypes.flatMap((c) => c.segments.map((s) => s.cab_pricing_id))))];

    console.log(`  source package: #${source.id} ${source.title}`);
    console.log(`    ${days} day(s), ${nights} night(s), ${hotelIds.length} hotel(s), ${activityVariantIds.length} activity variant(s), ${cabPricingIds.length} cab rate(s)\n`);

    // A quote prices exactly ONE (duration, route, stay category) combination, so
    // the figure that matters is the most expensive single combination — not the
    // sum of every itinerary row, which counts each duration and stay tier again.
    let worst = 0;
    let worstLabel = "";
    for (const dur of source.durations) {
        for (const route of dur.routes) {
            for (const cat of source.stay_categories) {
                const itins = source.itineraries.filter((i) => i.duration_id === dur.id && i.route_id === route.id);
                const stays = itins.flatMap((i) => i.itineraryStays.filter((s) => s.stay_category_id === cat.id));
                if (stays.length === 0) continue;
                const cost =
                    stays.reduce((n, s) => n + s.num_nights, 0) * BUDGET.hotelPerNight +
                    stays.reduce((n, s) => n + s.active_meals.length, 0) * 2 * BUDGET.mealPerPersonPerMeal +
                    itins.reduce((n, i) => n + i.itinerary_activities.filter((a) => !a.is_optional).length, 0) * 2 * BUDGET.activityPerPerson +
                    itins.length * BUDGET.cabPerDay +
                    dur.permits.filter((p) => p.is_included).length * BUDGET.permitFlat;
                if (cost > worst) { worst = cost; worstLabel = `${dur.slug}/${route.slug}/${cat.slug}`; }
            }
        }
    }
    console.log(`  worst-case combination @ 2 adults: ₹${worst.toFixed(2)} → quote ₹${Math.ceil(worst)}  (${worstLabel})`);
    if (worst > 1) {
        console.log(`  ⚠ over ₹1.00 — lower BUDGET in this script, or that combination quotes ₹${Math.ceil(worst)}`);
    }
    console.log();

    if (!COMMIT) {
        console.log("  Would clone: package + images + durations/routes/stops + stay categories +");
        console.log("               itineraries (stays, activities, attractions, transfers) +");
        console.log("               cab types/segments + permits, plus its own copies of every");
        console.log("               priced dependency (hotels, rooms, rates, cab_pricing,");
        console.log("               activity variants) so no live pricing row is touched.\n");
        console.log("  Re-run with --commit to apply.\n");
        return;
    }

    manifest = new ManifestWriter({ packageSlug: source.slug, hotelSlug: null });

    // ── 1. Hotels the itinerary stays on ────────────────────────────────────
    // Cloned wholesale so the clone owns its rates; occupancy tiers are dropped
    // rather than copied, since a tier price REPLACES the base rate and would
    // silently override the fractional per-night cost set below.
    const roomPricingMap = new Map<number, number>(); // source rate id → clone rate id

    for (const hotelId of hotelIds) {
        const src = await db.hotels.findUniqueOrThrow({
            where: { id: hotelId },
            include: { hotelRooms: { include: { pricing: true } }, meal_pricing: true },
        });

        const hotel = await track("hotels", await db.hotels.create({
            data: {
                ...scalarsOf(src, [...REL.hotels, "slug", "name", "listing_status", "is_active", "margin_percentage", "gst_percentage"]),
                name: `${TAG} ${src.name}`,
                slug: uniqueSlug(src.slug),
                listing_status: "DRAFT",
                is_active: false,
                margin_percentage: 0,
                gst_percentage: 0,
            } as Parameters<typeof db.hotels.create>[0]["data"],
        }));
        note(`hotels #${hotel.id} ← ${src.name}`);

        for (const srcRoom of src.hotelRooms) {
            const room = await track("hotel_rooms", await db.hotel_rooms.create({
                data: {
                    ...scalarsOf(srcRoom, [...REL.hotel_rooms, "hotel_id", "slug"]),
                    hotel_id: hotel.id,
                    slug: `${SLUG_PREFIX}${srcRoom.slug}`.slice(0, 190),
                } as Parameters<typeof db.hotel_rooms.create>[0]["data"],
            }));

            for (const srcRate of srcRoom.pricing) {
                const rate = await track("hotel_room_pricing", await db.hotel_room_pricing.create({
                    data: {
                        ...scalarsOf(srcRate, ["hotel_id", "room_id", "price_per_night", "weekend_price_per_night", "extra_bed_rate", "weekend_extra_bed_rate", "original_price", "margin_percentage", "gst_percentage"]),
                        hotel_id: hotel.id,
                        room_id: room.id,
                        price_per_night: BUDGET.hotelPerNight.toFixed(2),
                        weekend_price_per_night: BUDGET.hotelPerNight.toFixed(2),
                        extra_bed_rate: "0.00",
                        weekend_extra_bed_rate: "0.00",
                        original_price: null,
                        margin_percentage: 0,
                        gst_percentage: 0,
                    } as Parameters<typeof db.hotel_room_pricing.create>[0]["data"],
                }));
                roomPricingMap.set(srcRate.id, rate.id);
            }
        }

        for (const srcMeal of src.meal_pricing) {
            await track("hotel_meal_pricing", await db.hotel_meal_pricing.create({
                data: {
                    ...scalarsOf(srcMeal, ["hotel_id", "price", "weekend_price"]),
                    hotel_id: hotel.id,
                    price: BUDGET.mealPerPersonPerMeal,
                    weekend_price: BUDGET.mealPerPersonPerMeal,
                } as Parameters<typeof db.hotel_meal_pricing.create>[0]["data"],
            }));
        }
    }

    // ── 2. Cab rates ─────────────────────────────────────────────────────────
    // PER_KM would multiply by itinerary distance and blow the budget wide open,
    // so every cloned rate is forced to PER_DAY at a flat fraction.
    const cabPricingMap = new Map<number, number>();
    for (const cpId of cabPricingIds) {
        const src = await db.cab_pricing.findUniqueOrThrow({ where: { id: cpId } });
        const clone = await track("cab_pricing", await db.cab_pricing.create({
            data: {
                ...scalarsOf(src, ["price", "cost_price", "pricing_type", "destination_id"]),
                // cab_pricing has @@unique([destination_id, vehicle_id]), so a clone
                // carrying the same destination collides with the row it copied.
                // Postgres treats NULLs as distinct, and the engine only reads
                // destination for a display label — which still resolves via
                // location_id, kept intact above.
                destination_id: null,
                price: BUDGET.cabPerDay.toFixed(2),
                cost_price: null,
                pricing_type: "PER_DAY",
            } as Parameters<typeof db.cab_pricing.create>[0]["data"],
        }));
        cabPricingMap.set(cpId, clone.id);
    }
    if (cabPricingMap.size) note(`cab_pricing ×${cabPricingMap.size} @ ₹${BUDGET.cabPerDay}/day`);

    // ── 3. Activity variants ─────────────────────────────────────────────────
    // The activity itself is shared and carries no price, so only the variant and
    // its pricing tiers are cloned.
    const variantMap = new Map<number, number>();
    for (const vId of activityVariantIds) {
        const src = await db.activity_variants.findUniqueOrThrow({ where: { id: vId }, include: { pricing: true } });
        const clone = await track("activity_variants", await db.activity_variants.create({
            data: {
                ...scalarsOf(src, [...REL.activity_variants, "name", "cost_price", "gst_percentage"]),
                name: `${TAG} ${src.name}`,
                cost_price: null,
                gst_percentage: 0,
            } as Parameters<typeof db.activity_variants.create>[0]["data"],
        }));
        variantMap.set(vId, clone.id);

        for (const tier of src.pricing) {
            await db.activity_variant_pricing.create({
                data: {
                    ...scalarsOf(tier, ["variant_id", "price", "original_price", "margin_percentage"]),
                    variant_id: clone.id,
                    price: BUDGET.activityPerPerson.toFixed(2),
                    original_price: null,
                    margin_percentage: 0,
                } as Parameters<typeof db.activity_variant_pricing.create>[0]["data"],
            });
        }
    }
    if (variantMap.size) note(`activity_variants ×${variantMap.size} @ ₹${BUDGET.activityPerPerson}/person`);

    // ── 4. The package itself ────────────────────────────────────────────────
    const pkg = await track("packages", await db.packages.create({
        data: {
            ...scalarsOf(source, [...REL.packages, "title", "slug", "is_active"]),
            title: `${TAG} ${source.title}`,
            slug: uniqueSlug(source.slug),
            // Must stay active — the quote page's fetch filters on it. Kept out of
            // listings by slug instead (app/lib/packages/internal-skus.ts).
            is_active: true,
        } as Parameters<typeof db.packages.create>[0]["data"],
    }));
    note(`packages #${pkg.id} ← ${source.title}`);

    for (const img of source.images) {
        await track("package_images", await db.package_images.create({
            data: { ...scalarsOf(img, ["package_id"]), package_id: pkg.id } as Parameters<typeof db.package_images.create>[0]["data"],
        }));
    }

    const durationMap = new Map<number, number>();
    const routeMap = new Map<number, number>();
    const cabTypeMap = new Map<number, number>();

    for (const srcDur of source.durations) {
        const dur = await track("package_durations", await db.package_durations.create({
            data: { ...scalarsOf(srcDur, [...REL.package_durations, "package_id"]), package_id: pkg.id } as Parameters<typeof db.package_durations.create>[0]["data"],
        }));
        durationMap.set(srcDur.id, dur.id);

        for (const srcRoute of srcDur.routes) {
            const route = await track("package_routes", await db.package_routes.create({
                data: {
                    ...scalarsOf(srcRoute, [...REL.package_routes, "duration_id", "packagesId"]),
                    duration_id: dur.id,
                    packagesId: pkg.id,
                } as Parameters<typeof db.package_routes.create>[0]["data"],
            }));
            routeMap.set(srcRoute.id, route.id);

            for (const stop of srcRoute.stops) {
                await track("route_stops", await db.route_stops.create({
                    data: { ...scalarsOf(stop, ["route_id"]), route_id: route.id } as Parameters<typeof db.route_stops.create>[0]["data"],
                }));
            }
        }

        for (const srcCab of srcDur.cabTypes) {
            const cab = await track("package_cab_types", await db.package_cab_types.create({
                data: {
                    ...scalarsOf(srcCab, [...REL.package_cab_types, "package_id", "duration_id"]),
                    package_id: pkg.id,
                    duration_id: dur.id,
                } as Parameters<typeof db.package_cab_types.create>[0]["data"],
            }));
            cabTypeMap.set(srcCab.id, cab.id);

            for (const seg of srcCab.segments) {
                await track("package_cab_segments", await db.package_cab_segments.create({
                    data: {
                        ...scalarsOf(seg, ["cab_type_id", "cab_pricing_id"]),
                        cab_type_id: cab.id,
                        cab_pricing_id: cabPricingMap.get(seg.cab_pricing_id) ?? seg.cab_pricing_id,
                    } as Parameters<typeof db.package_cab_segments.create>[0]["data"],
                }));
            }
        }

        // Permit price lives on this row directly — no shared row to clone.
        for (const permit of srcDur.permits) {
            await track("package_permits", await db.package_permits.create({
                data: {
                    ...scalarsOf(permit, ["package_id", "duration_id", "cab_type_id", "price"]),
                    package_id: pkg.id,
                    duration_id: dur.id,
                    cab_type_id: permit.cab_type_id != null ? cabTypeMap.get(permit.cab_type_id) ?? null : null,
                    price: BUDGET.permitFlat.toFixed(2),
                } as Parameters<typeof db.package_permits.create>[0]["data"],
            }));
        }
    }

    const stayCatMap = new Map<number, number>();
    for (const srcCat of source.stay_categories) {
        const cat = await track("package_stay_categories", await db.package_stay_categories.create({
            data: { ...scalarsOf(srcCat, ["package_id"]), package_id: pkg.id } as Parameters<typeof db.package_stay_categories.create>[0]["data"],
        }));
        stayCatMap.set(srcCat.id, cat.id);
    }

    // 0% margin and GST: each rounds up independently, so any non-zero rate adds
    // a whole rupee to a sub-₹1 base.
    for (const srcPricing of source.packagePricings) {
        const dId = durationMap.get(srcPricing.duration_id);
        const cId = stayCatMap.get(srcPricing.stay_category_id);
        if (dId == null || cId == null) continue;
        await track("package_pricing", await db.package_pricing.create({
            data: { package_id: pkg.id, duration_id: dId, stay_category_id: cId, margin_percentage: 0, gst_percentage: 0 },
        }));
    }

    for (const srcItin of source.itineraries) {
        const dId = durationMap.get(srcItin.duration_id);
        const rId = routeMap.get(srcItin.route_id);
        if (dId == null || rId == null) continue;

        const itin = await track("package_itineraries", await db.package_itineraries.create({
            data: {
                ...scalarsOf(srcItin, [...REL.package_itineraries, "package_id", "duration_id", "route_id"]),
                package_id: pkg.id, duration_id: dId, route_id: rId,
            } as Parameters<typeof db.package_itineraries.create>[0]["data"],
        }));

        for (const stay of srcItin.itineraryStays) {
            const catId = stayCatMap.get(stay.stay_category_id);
            const rateId = roomPricingMap.get(stay.room_pricing_id);
            if (catId == null || rateId == null) continue;
            await track("itinerary_stays", await db.itinerary_stays.create({
                data: {
                    ...scalarsOf(stay, [...REL.itinerary_stays, "itinerary_id", "stay_category_id", "room_pricing_id"]),
                    itinerary_id: itin.id, stay_category_id: catId, room_pricing_id: rateId,
                } as Parameters<typeof db.itinerary_stays.create>[0]["data"],
            }));
        }

        for (const act of srcItin.itinerary_activities) {
            await track("itinerary_activities", await db.itinerary_activities.create({
                data: {
                    ...scalarsOf(act, [...REL.itinerary_activities, "itinerary_id", "variant_id"]),
                    itinerary_id: itin.id,
                    variant_id: act.variant_id != null ? variantMap.get(act.variant_id) ?? null : null,
                } as Parameters<typeof db.itinerary_activities.create>[0]["data"],
            }));
        }

        for (const att of srcItin.itinerary_attractions) {
            await track("itinerary_attractions", await db.itinerary_attractions.create({
                data: { ...scalarsOf(att, ["itinerary_id"]), itinerary_id: itin.id } as Parameters<typeof db.itinerary_attractions.create>[0]["data"],
            }));
        }

        for (const tr of srcItin.itinerary_transfers) {
            await track("itinerary_transfers", await db.itinerary_transfers.create({
                data: { ...scalarsOf(tr, ["itinerary_id"]), itinerary_id: itin.id } as Parameters<typeof db.itinerary_transfers.create>[0]["data"],
            }));
        }
    }

    manifest.save();

    const pkgSlug = pkg.slug;
    const defaultDur = source.durations.find((d) => d.is_default) ?? source.durations[0];
    const defaultRoute = defaultDur?.routes[0];
    const defaultCat = source.stay_categories.find((c) => c.is_default) ?? source.stay_categories[0];

    console.log(`\n  ${manifest.count} rows created and recorded to the manifest.\n`);
    console.log(`  Package  /packages/${pkgSlug}/${defaultDur?.slug ?? "?"}/${defaultRoute?.slug ?? "?"}/${defaultCat?.slug ?? "?"}`);
    console.log(`\n  Add "${pkgSlug}" to INTERNAL_PACKAGE_SLUGS to keep it out of listings.`);
    console.log(`  Remove everything again with:  npm run teardown:test-clone -- --commit\n`);
}

main()
    .catch((e) => {
        console.error("\nclone-test-skus failed:", e);
        // Persist whatever was created before the failure, so a partial run is
        // still fully removable rather than becoming untracked orphans.
        try { if (manifest && manifest.count > 0) { manifest.save(); console.error(`Partial run: ${manifest.count} row(s) recorded — run teardown to remove them.`); } } catch { /* best effort */ }
        process.exit(1);
    })
    .finally(() => db.$disconnect());
