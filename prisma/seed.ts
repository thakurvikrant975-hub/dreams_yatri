import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱  Seeding database...\n");

  // ── 1. Region ──────────────────────────────────────────────────────────────
  const region = await db.custom_regions.upsert({
    where: { slug: "north-india" },
    update: {},
    create: {
      name: "North India",
      slug: "north-india",
      country: "India",
      is_active: true,
    },
  });
  console.log(`   ✓ Region: ${region.name}`);

  // ── 2. Destination ─────────────────────────────────────────────────────────
  const destination = await db.destinations.upsert({
    where: { slug: "manali" },
    update: {},
    create: {
      name: "Manali",
      slug: "manali",
      country: "India",
      region_id: region.id,
      is_active: true,
      description: "A high-altitude Himalayan resort town in Himachal Pradesh, famous for snow, adventure, and scenic beauty.",
      latitude: 32.2396,
      longitude: 77.1887,
    },
  });
  console.log(`   ✓ Destination: ${destination.name}`);

  // ── 3. Meal types ──────────────────────────────────────────────────────────
  const [mealEP, mealCP] = await Promise.all([
    db.meal_types.upsert({ where: { name: "EP (Room Only)" }, update: {}, create: { name: "EP (Room Only)" } }),
    db.meal_types.upsert({ where: { name: "CP (Breakfast)" }, update: {}, create: { name: "CP (Breakfast)" } }),
  ]);

  // ── 4. Hotels ──────────────────────────────────────────────────────────────
  // Delete and recreate so the seed is re-runnable
  await db.hotels.deleteMany({
    where: { slug: { in: ["snow-peak-inn-manali", "alpine-heights-manali"] } },
  });

  const hotelStandard = await db.hotels.create({
    data: {
      name: "Snow Peak Inn",
      slug: "snow-peak-inn-manali",
      destination_id: destination.id,
      address: "Mall Road, Manali, HP 175131",
      check_in_time: "14:00",
      check_out_time: "11:00",
      is_active: true,
      category: "Hotel",
      stay_type: "Hotel",
      description: "A cozy 3-star property on Mall Road with mountain views and warm hospitality.",
    },
  });

  const roomStandard = await db.hotel_rooms.create({
    data: {
      hotel_id: hotelStandard.id,
      name: "Standard Double",
      slug: "standard-double",
      bed_type: "Double Bed",
      max_occupancy: 2,
      area_sqft: 220,
      is_active: true,
    },
  });

  const pricingStandardEP = await db.hotel_room_pricing.create({
    data: {
      hotel_id: hotelStandard.id,
      room_id: roomStandard.id,
      plan_name: "Room Only",
      meal_type_id: mealEP.id,
      price_per_night: 2500,
      original_price: 3200,
      margin_percentage: 15,
      gst_percentage: 12,
      is_active: true,
    },
  });

  const hotelDeluxe = await db.hotels.create({
    data: {
      name: "Alpine Heights",
      slug: "alpine-heights-manali",
      destination_id: destination.id,
      address: "Hadimba Road, Manali, HP 175131",
      check_in_time: "13:00",
      check_out_time: "11:00",
      is_active: true,
      category: "Hotel",
      stay_type: "Hotel",
      description: "A 4-star retreat near Hadimba Temple with panoramic valley views and modern amenities.",
    },
  });

  const roomDeluxe = await db.hotel_rooms.create({
    data: {
      hotel_id: hotelDeluxe.id,
      name: "Deluxe Valley View",
      slug: "deluxe-valley-view",
      bed_type: "King Bed",
      max_occupancy: 2,
      area_sqft: 320,
      view_type: "Valley View",
      is_active: true,
    },
  });

  const pricingDeluxeCP = await db.hotel_room_pricing.create({
    data: {
      hotel_id: hotelDeluxe.id,
      room_id: roomDeluxe.id,
      plan_name: "Breakfast Included",
      meal_type_id: mealCP.id,
      price_per_night: 4500,
      original_price: 5800,
      margin_percentage: 20,
      gst_percentage: 12,
      is_active: true,
    },
  });

  console.log(`   ✓ Hotels: ${hotelStandard.name}, ${hotelDeluxe.name}`);

  // ── 5. Activities ──────────────────────────────────────────────────────────
  await db.activities.deleteMany({
    where: {
      slug: {
        in: [
          "hadimba-temple-visit",
          "solang-valley-snow-sports",
          "beas-river-rafting",
          "old-manali-walk",
        ],
      },
    },
  });

  const activityTemple = await db.activities.create({
    data: {
      name: "Hadimba Temple Visit",
      slug: "hadimba-temple-visit",
      description: "Visit the ancient wooden Hadimba Devi Temple set amid a cedar forest. One of Manali's most revered landmarks.",
      duration_hours: 2,
      difficulty: "Easy",
      is_active: true,
      variants: {
        create: {
          name: "Guided Visit",
          booking_mode: "GUIDED",
          pricing_type: "PER_PERSON",
          is_active: true,
          sort_order: 0,
          pricing: {
            create: [
              { label: "Adult", price: 499, original_price: 599, margin_percentage: 10, is_active: true, sort_order: 0 },
              { label: "Child (5–12)", price: 249, original_price: 299, margin_percentage: 10, is_active: true, sort_order: 1 },
            ],
          },
        },
      },
    },
    include: { variants: true },
  });

  const activitySolang = await db.activities.create({
    data: {
      name: "Solang Valley Snow Sports",
      slug: "solang-valley-snow-sports",
      description: "Skiing, snow scooter rides, and cable car at the spectacular Solang Valley — 14 km from Manali.",
      duration_hours: 5,
      difficulty: "Moderate",
      is_active: true,
      variants: {
        create: {
          name: "Full Day Package",
          booking_mode: "SELF",
          pricing_type: "PER_PERSON",
          is_active: true,
          sort_order: 0,
          pricing: {
            create: [
              { label: "Adult", price: 1799, original_price: 2199, margin_percentage: 12, is_active: true, sort_order: 0 },
              { label: "Child (5–12)", price: 899, original_price: 1099, margin_percentage: 12, is_active: true, sort_order: 1 },
            ],
          },
        },
      },
    },
    include: { variants: true },
  });

  const activityRafting = await db.activities.create({
    data: {
      name: "Beas River Rafting",
      slug: "beas-river-rafting",
      description: "Thrilling Grade II–III rapids on the Beas River between Pirdi and Jhiri — 14 km of white water action.",
      duration_hours: 3,
      difficulty: "Moderate",
      is_active: true,
      variants: {
        create: {
          name: "14 km Stretch",
          booking_mode: "GUIDED",
          pricing_type: "PER_PERSON",
          is_active: true,
          sort_order: 0,
          pricing: {
            create: [
              { label: "Per Person", price: 1199, original_price: 1499, margin_percentage: 15, is_active: true, sort_order: 0 },
            ],
          },
        },
      },
    },
    include: { variants: true },
  });

  const activityOldManali = await db.activities.create({
    data: {
      name: "Old Manali Heritage Walk",
      slug: "old-manali-walk",
      description: "Wander through the Old Manali village market, charming cafés, and the ancient Manu Temple.",
      duration_hours: 2.5,
      difficulty: "Easy",
      is_active: true,
      variants: {
        create: {
          name: "Self Guided",
          booking_mode: "SELF",
          pricing_type: "PER_PERSON",
          is_active: true,
          sort_order: 0,
          pricing: {
            create: [
              { label: "Per Person", price: 0, original_price: null, margin_percentage: 0, is_active: true, sort_order: 0 },
            ],
          },
        },
      },
    },
    include: { variants: true },
  });

  console.log(`   ✓ Activities: ${activityTemple.name}, ${activitySolang.name}, ${activityRafting.name}, ${activityOldManali.name}`);

  // ── 6. Vehicles ────────────────────────────────────────────────────────────
  await db.vehicles.deleteMany({
    where: { name: { in: ["Innova Crysta (Seed)", "Tempo Traveller (Seed)"] } },
  });

  const vehicleInnova = await db.vehicles.create({
    data: {
      name: "Innova Crysta (Seed)",
      type: "SUV",
      passenger_capacity: 6,
      luggage_bags: 4,
      is_active: true,
      rates: {
        create: [
          { label: "Delhi → Manali (One Way)", rate_type: "FLAT_TRIP", price: 8500, cost_price: 7000, is_active: true },
          { label: "Manali Local Day Trip", rate_type: "PER_DAY", price: 3500, cost_price: 2800, is_active: true },
        ],
      },
    },
  });

  console.log(`   ✓ Vehicle: ${vehicleInnova.name}`);

  // ── 7. Transfer routes ─────────────────────────────────────────────────────
  await db.transfer_routes.deleteMany({
    where: {
      OR: [
        { pickup_name: "Delhi (Seed)", drop_name: "Manali" },
        { pickup_name: "Manali", drop_name: "Delhi (Seed)" },
        { pickup_name: "Manali Hotel", drop_name: "Solang Valley" },
      ],
    },
  });

  const [trDelhiManali, trManaliDelhi, trSolang] = await Promise.all([
    db.transfer_routes.create({
      data: { pickup_name: "Delhi (Seed)", drop_name: "Manali", distance_km: 540, duration_min: 660 },
    }),
    db.transfer_routes.create({
      data: { pickup_name: "Manali", drop_name: "Delhi (Seed)", distance_km: 540, duration_min: 660 },
    }),
    db.transfer_routes.create({
      data: { pickup_name: "Manali Hotel", drop_name: "Solang Valley", distance_km: 14, duration_min: 45 },
    }),
  ]);

  console.log("   ✓ Transfer routes: Delhi↔Manali, Manali→Solang Valley");

  // ── 8. Package ─────────────────────────────────────────────────────────────
  await db.packages.deleteMany({ where: { slug: "manali-adventure" } });

  const pkg = await db.packages.create({
    data: {
      title: "Manali Adventure Package",
      slug: "manali-adventure",
      destination_id: destination.id,
      description:
        "A complete Manali adventure — snow sports at Solang Valley, river rafting on Beas, and the serenity of Hadimba Temple. Comfortable stays, private transfers, and unforgettable Himalayan memories.",
      inclusions: [
        "Hotel accommodation (as per selected category)",
        "All transfers by private cab",
        "Solang Valley snow activities",
        "River rafting on Beas",
        "Hadimba Temple guided visit",
        "Toll charges and driver allowance",
      ],
      exclusions: [
        "Airfare / train fare to Delhi",
        "Rohtang Pass permit (₹600 per person)",
        "Personal expenses and tips",
        "Travel insurance",
        "Meals not mentioned in inclusions",
        "Any activity not listed in itinerary",
      ],
      is_active: true,
    },
  });

  // Package images (Unsplash placeholders)
  await db.package_images.createMany({
    data: [
      { package_id: pkg.id, url: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200", is_primary: true, sort_order: 0, alt: "Manali mountains" },
      { package_id: pkg.id, url: "https://images.unsplash.com/photo-1590577976322-3d2d6e2130d5?w=1200", is_primary: false, sort_order: 1, alt: "Solang Valley" },
      { package_id: pkg.id, url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200", is_primary: false, sort_order: 2, alt: "Himalayan landscape" },
      { package_id: pkg.id, url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200", is_primary: false, sort_order: 3, alt: "Adventure travel" },
    ],
  });

  // ── 9. Stay categories ─────────────────────────────────────────────────────
  const stayStandard = await db.package_stay_categories.create({
    data: {
      package_id: pkg.id,
      slug: "standard",
      label: "Standard",
      description: "3-star hotels, room-only plan. Clean, comfortable, and budget-friendly.",
      is_default: true,
      sort_order: 0,
      is_active: true,
    },
  });

  const stayDeluxe = await db.package_stay_categories.create({
    data: {
      package_id: pkg.id,
      slug: "deluxe",
      label: "Deluxe",
      description: "4-star hotels with daily breakfast. Better views and superior amenities.",
      is_default: false,
      sort_order: 1,
      is_active: true,
    },
  });

  // ── 10. Durations ──────────────────────────────────────────────────────────
  const duration5D = await db.package_durations.create({
    data: {
      package_id: pkg.id,
      slug: "5d-4n",
      label: "5 Days / 4 Nights",
      days: 5,
      nights: 4,
      is_default: true,
      sort_order: 0,
      is_active: true,
    },
  });

  const duration7D = await db.package_durations.create({
    data: {
      package_id: pkg.id,
      slug: "7d-6n",
      label: "7 Days / 6 Nights",
      days: 7,
      nights: 6,
      is_default: false,
      sort_order: 1,
      is_active: true,
    },
  });

  // ── 11. Routes ─────────────────────────────────────────────────────────────
  const route5D_Delhi = await db.package_routes.create({
    data: {
      duration_id: duration5D.id,
      packagesId: pkg.id,
      name: "From Delhi",
      slug: "from-delhi",
      meta_title: "Manali Adventure 5D/4N (From Delhi) | Dreams Yatri",
      meta_desc: "5-day Manali adventure departing from Delhi — Solang Valley, Beas rafting, and Hadimba Temple.",
      sort_order: 0,
      is_active: true,
      stops: {
        create: [
          { place_name: "Delhi", stay_days: 0, sort_order: 0 },
          { place_name: "Manali", stay_days: 4, sort_order: 1 },
        ],
      },
    },
  });

  const route5D_Chandigarh = await db.package_routes.create({
    data: {
      duration_id: duration5D.id,
      packagesId: pkg.id,
      name: "From Chandigarh",
      slug: "from-chandigarh",
      meta_title: "Manali Adventure 5D/4N (From Chandigarh) | Dreams Yatri",
      meta_desc: "5-day Manali adventure departing from Chandigarh.",
      sort_order: 1,
      is_active: true,
      stops: {
        create: [
          { place_name: "Chandigarh", stay_days: 0, sort_order: 0 },
          { place_name: "Manali", stay_days: 4, sort_order: 1 },
        ],
      },
    },
  });

  await db.package_routes.create({
    data: {
      duration_id: duration7D.id,
      packagesId: pkg.id,
      name: "From Delhi (7D)",
      slug: "from-delhi",
      meta_title: "Manali Adventure 7D/6N | Dreams Yatri",
      meta_desc: "7-day extended Manali adventure from Delhi.",
      sort_order: 0,
      is_active: true,
      stops: {
        create: [
          { place_name: "Delhi", stay_days: 0, sort_order: 0 },
          { place_name: "Kullu", stay_days: 2, sort_order: 1 },
          { place_name: "Manali", stay_days: 4, sort_order: 2 },
        ],
      },
    },
  });

  console.log(`   ✓ Routes: ${route5D_Delhi.name}, ${route5D_Chandigarh.name}`);

  // ── 12. Itinerary — 5D/4N, From Delhi ─────────────────────────────────────
  // Day 1: Departure (overnight drive, no hotel stay)
  const itin1 = await db.package_itineraries.create({
    data: {
      package_id: pkg.id,
      duration_id: duration5D.id,
      route_id: route5D_Delhi.id,
      day: 1,
      title: "Delhi Departure → Manali",
      description:
        "Board your private cab from Delhi in the evening. Enjoy a scenic overnight drive through the Himalayan foothills. Arrive Manali early morning.",
    },
  });

  await db.itinerary_transfers.create({
    data: {
      itinerary_id: itin1.id,
      route_id: trDelhiManali.id,
      notes: "Pickup from Delhi at 6:00 PM. Estimated arrival at Manali ~8:00 AM next day.",
      sort_order: 0,
    },
  });

  await db.itinerary_notes.create({
    data: {
      itinerary_id: itin1.id,
      message: "Overnight drive — carry a blanket and neck pillow for comfort.",
      type: "info",
      position: "bottom",
      sort_order: 0,
    },
  });

  // Day 2: Manali arrival + Hadimba Temple + Old Manali
  const itin2 = await db.package_itineraries.create({
    data: {
      package_id: pkg.id,
      duration_id: duration5D.id,
      route_id: route5D_Delhi.id,
      day: 2,
      title: "Manali Arrival — Hadimba Temple & Old Manali",
      description:
        "Check into your hotel. After freshening up, visit the iconic Hadimba Devi Temple, then stroll through the charming lanes of Old Manali village.",
    },
  });

  await db.itinerary_stays.createMany({
    data: [
      { itinerary_id: itin2.id, stay_category_id: stayStandard.id, room_pricing_id: pricingStandardEP.id, occupancy: 2, rooms_count: 1 },
      { itinerary_id: itin2.id, stay_category_id: stayDeluxe.id, room_pricing_id: pricingDeluxeCP.id, occupancy: 2, rooms_count: 1 },
    ],
  });

  await db.itinerary_activities.createMany({
    data: [
      { itinerary_id: itin2.id, activity_id: activityTemple.id, variant_id: activityTemple.variants[0].id, sort_order: 0, is_optional: false },
      { itinerary_id: itin2.id, activity_id: activityOldManali.id, variant_id: activityOldManali.variants[0].id, sort_order: 1, is_optional: false },
    ],
  });

  // Day 3: Solang Valley
  const itin3 = await db.package_itineraries.create({
    data: {
      package_id: pkg.id,
      duration_id: duration5D.id,
      route_id: route5D_Delhi.id,
      day: 3,
      title: "Solang Valley Snow Adventure",
      description:
        "Full day at Solang Valley — try skiing, snow scooters, and the panoramic cable car. Return to Manali in the evening for a leisurely dinner.",
    },
  });

  await db.itinerary_stays.createMany({
    data: [
      { itinerary_id: itin3.id, stay_category_id: stayStandard.id, room_pricing_id: pricingStandardEP.id, occupancy: 2, rooms_count: 1 },
      { itinerary_id: itin3.id, stay_category_id: stayDeluxe.id, room_pricing_id: pricingDeluxeCP.id, occupancy: 2, rooms_count: 1 },
    ],
  });

  await db.itinerary_transfers.create({
    data: {
      itinerary_id: itin3.id,
      route_id: trSolang.id,
      notes: "Round trip from hotel to Solang Valley. Departure at 9:00 AM.",
      sort_order: 0,
    },
  });

  await db.itinerary_activities.create({
    data: {
      itinerary_id: itin3.id,
      activity_id: activitySolang.id,
      variant_id: activitySolang.variants[0].id,
      sort_order: 0,
      is_optional: false,
    },
  });

  // Day 4: Beas River Rafting
  const itin4 = await db.package_itineraries.create({
    data: {
      package_id: pkg.id,
      duration_id: duration5D.id,
      route_id: route5D_Delhi.id,
      day: 4,
      title: "Beas River Rafting",
      description:
        "Conquer Grade II–III rapids on the Beas River. Afternoon is free for shopping in Manali market — pick up pashmina shawls and Kullu handicrafts.",
    },
  });

  await db.itinerary_stays.createMany({
    data: [
      { itinerary_id: itin4.id, stay_category_id: stayStandard.id, room_pricing_id: pricingStandardEP.id, occupancy: 2, rooms_count: 1 },
      { itinerary_id: itin4.id, stay_category_id: stayDeluxe.id, room_pricing_id: pricingDeluxeCP.id, occupancy: 2, rooms_count: 1 },
    ],
  });

  await db.itinerary_activities.create({
    data: {
      itinerary_id: itin4.id,
      activity_id: activityRafting.id,
      variant_id: activityRafting.variants[0].id,
      sort_order: 0,
      is_optional: false,
    },
  });

  await db.itinerary_notes.create({
    data: {
      itinerary_id: itin4.id,
      message: "Rafting is subject to river conditions and water levels. An alternative activity will be arranged if the river is not suitable.",
      type: "warning",
      position: "bottom",
      sort_order: 0,
    },
  });

  // Day 5: Departure
  const itin5 = await db.package_itineraries.create({
    data: {
      package_id: pkg.id,
      duration_id: duration5D.id,
      route_id: route5D_Delhi.id,
      day: 5,
      title: "Manali Departure",
      description:
        "Check out after breakfast. Board your private cab for the return journey to Delhi. Carry the memories of Himalayan adventures!",
    },
  });

  await db.itinerary_transfers.create({
    data: {
      itinerary_id: itin5.id,
      route_id: trManaliDelhi.id,
      notes: "Departure from Manali at 8:00 AM. Estimated arrival in Delhi by 8:00–10:00 PM.",
      sort_order: 0,
    },
  });

  console.log("   ✓ Itinerary: 5 days (5D/4N, From Delhi route)");

  // ── 13. Package Pricing ────────────────────────────────────────────────────
  await db.package_pricing.createMany({
    data: [
      { package_id: pkg.id, duration_id: duration5D.id, stay_category_id: stayStandard.id, margin_percentage: 15, gst_percentage: 5 },
      { package_id: pkg.id, duration_id: duration5D.id, stay_category_id: stayDeluxe.id, margin_percentage: 20, gst_percentage: 5 },
      { package_id: pkg.id, duration_id: duration7D.id, stay_category_id: stayStandard.id, margin_percentage: 15, gst_percentage: 5 },
      { package_id: pkg.id, duration_id: duration7D.id, stay_category_id: stayDeluxe.id, margin_percentage: 20, gst_percentage: 5 },
    ],
  });

  console.log("   ✓ Package pricing: 4 combos (2 durations × 2 stay categories)");

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log(`
✅  Seed complete!

   Package  : ${pkg.title}
   Slug     : ${pkg.slug}
   Website  : /packages/manali-adventure/5d-4n/from-delhi/standard
              /packages/manali-adventure/5d-4n/from-delhi/deluxe
              /packages/manali-adventure/5d-4n/from-chandigarh/standard
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
