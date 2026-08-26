// Throwaway probe: replays the real cab engine over EVERY package in the
// database, with and without the `transport` evidence, and asserts the fix
// only ever adds ₹0 gap lines — it must never move a price.
import { db } from "../app/lib/db";
import { computeBuilderCabPricing } from "../app/services/package-pricing.service";
import { parseCabSelections } from "../app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";

async function main() {
  const pkgs = await db.custom_packages.findMany({
    select: {
      id: true, title: true, status: true, travelDate: true,
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          day: true, cabPricingId: true, transportDistanceKm: true,
          cabQuantity: true, extraCabs: true, cabPriceOverride: true, transport: true,
        },
      },
    },
  });

  let checked = 0, moved = 0, gained = 0, noCabs = 0, unchanged = 0;
  const gainers: string[] = [];

  for (const pkg of pkgs) {
    if (pkg.itineraries.length === 0) continue;
    const travelDate = pkg.travelDate ? pkg.travelDate.toISOString().slice(0, 10) : null;
    const days = pkg.itineraries.map((it) => ({
      day: it.day, cabPricingId: it.cabPricingId, transportDistanceKm: it.transportDistanceKm,
      cabQuantity: it.cabQuantity, extraCabs: parseCabSelections(it.extraCabs),
      cabPriceOverride: it.cabPriceOverride, transport: it.transport,
    }));

    const before = await computeBuilderCabPricing({ travelDate, days: days.map(({ transport, ...d }) => d) });
    const after = await computeBuilderCabPricing({ travelDate, days });
    checked++;

    // 1. The subtotal must be untouched, always.
    if (before.cabSubtotal !== after.cabSubtotal) {
      moved++;
      console.log(`PRICE MOVED  ${pkg.title} (${pkg.id}): ₹${before.cabSubtotal} -> ₹${after.cabSubtotal}`);
    }
    // 2. Every line that existed before must survive byte-identical.
    const beforeKeys = before.days.map((l) => JSON.stringify(l));
    const afterKeys = after.days.map((l) => JSON.stringify(l));
    for (const k of beforeKeys) {
      if (!afterKeys.includes(k)) console.log(`LINE CHANGED ${pkg.title} (${pkg.id}): ${k}`);
    }
    // 3. Anything new must be a ₹0 gap line.
    const added = after.days.filter((l) => !beforeKeys.includes(JSON.stringify(l)));
    for (const l of added) {
      if (l.gap !== "no-cab-rate" || l.total !== 0) {
        console.log(`BAD NEW LINE ${pkg.title} (${pkg.id}): ${JSON.stringify(l)}`);
      }
    }

    if (added.length > 0) {
      gained++;
      gainers.push(`  ${pkg.status.padEnd(8)} ${pkg.title} — day(s) ${added.map((l) => l.day).join(", ")} now visible at ₹0`);
    } else if (after.days.length === 0) {
      noCabs++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nchecked ${checked} packages`);
  console.log(`  subtotals moved:            ${moved}   (must be 0)`);
  console.log(`  gained a ₹0 gap line:       ${gained}`);
  console.log(`  no cabs at all, still none: ${noCabs}`);
  console.log(`  identical breakdown:        ${unchanged}`);
  console.log(gainers.join("\n"));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
