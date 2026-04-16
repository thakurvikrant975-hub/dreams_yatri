import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import { ALL_SYSTEM_HOTEL_CATEGORIES } from "@/app/lib/hotelImageCategories";

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const db      = new PrismaClient({ adapter } as never);

async function seed() {
  console.log("🌱 Seeding Dreams Yatri...\n");

// 🔐 User related
await db.payment.deleteMany();
await db.booking.deleteMany();
await db.travelPreference.deleteMany();
await db.otp.deleteMany();
await db.magicSession.deleteMany();
await db.verificationToken.deleteMany();

// 📦 Package relations
await db.package_activities.deleteMany();
await db.package_hotels.deleteMany();
await db.package_tags.deleteMany();
await db.package_categories.deleteMany();
await db.package_pricing.deleteMany();
await db.package_itineraries.deleteMany();
await db.package_durations.deleteMany();
await db.package_stay_categories.deleteMany();
await db.package_images.deleteMany();
await db.packages.deleteMany();

// 🎯 Activities
await db.activity_images.deleteMany();
await db.activities.deleteMany();

// 🏨 Hotels (🔥 VERY IMPORTANT ORDER)
await db.hotel_room_pricing.deleteMany();
await db.hotel_images.deleteMany();              // ✅ child FIRST
await db.hotel_image_categories.deleteMany();   // ✅ then parent
await db.hotels.deleteMany();                   // ✅ then main

// 🏷️ Other master data
await db.pricing_rules.deleteMany();
await db.images.deleteMany();
await db.tags.deleteMany();
await db.categories.deleteMany();
await db.destinations.deleteMany();
await db.regions.deleteMany();

console.log("🧹 Cleared all tables\n");

  // ════════════════════════════════════════════════════════════════════════
  // 1. GEOGRAPHY
  // ════════════════════════════════════════════════════════════════════════

  const northIndia = await db.regions.create({ data: { name: "North India", slug: "north-india", country: "India", description: "Himalayas, valleys and heritage cities.", meta_title: "North India Tour Packages | Dreams Yatri", meta_desc: "Explore Kashmir and Himachal with Dreams Yatri." } });
  const westIndia  = await db.regions.create({ data: { name: "West India",  slug: "west-india",  country: "India", description: "Beaches, deserts and vibrant culture.",   meta_title: "West India Tour Packages | Dreams Yatri",  meta_desc: "Explore Goa and Rajasthan with Dreams Yatri."  } });

  const kashmir = await db.destinations.create({ data: { name: "Kashmir",          slug: "kashmir",          region_id: northIndia.id, country: "India", description: "Paradise on earth — Dal Lake, Gulmarg and Pahalgam.", meta_title: "Kashmir Tour Packages | Dreams Yatri",           meta_desc: "Book Kashmir packages with Dreams Yatri."      } });
  const himachal= await db.destinations.create({ data: { name: "Himachal Pradesh", slug: "himachal-pradesh", region_id: northIndia.id, country: "India", description: "Snow peaks, apple orchards and adventure trails.",    meta_title: "Himachal Tour Packages | Dreams Yatri",          meta_desc: "Shimla and Manali with Dreams Yatri."          } });
  const goa     = await db.destinations.create({ data: { name: "Goa",              slug: "goa",              region_id: westIndia.id,  country: "India", description: "Sun, sand, seafood and vibrant beach culture.",      meta_title: "Goa Tour Packages | Dreams Yatri",               meta_desc: "Best Goa packages with Dreams Yatri."           } });
  console.log("✅ Regions: 2 | Destinations: 3");

  // ════════════════════════════════════════════════════════════════════════
  // 2. CLASSIFICATION
  // ════════════════════════════════════════════════════════════════════════

  const [catHill, catAdventure, catHoneymoon, catBeach] = await Promise.all([
    db.categories.create({ data: { name: "Hill Station", slug: "hill-station", sort_order: 1 } }),
    db.categories.create({ data: { name: "Adventure",    slug: "adventure",    sort_order: 2 } }),
    db.categories.create({ data: { name: "Honeymoon",    slug: "honeymoon",    sort_order: 3 } }),
    db.categories.create({ data: { name: "Beach",        slug: "beach",        sort_order: 4 } }),
  ]);

  const [tagSnow, tagAdventure, tagFamily, tagHoneymoon, tagBudget, tagLuxury, tagSummer] = await Promise.all([
    db.tags.create({ data: { name: "Snow",      slug: "snow",      group: "activity" } }),
    db.tags.create({ data: { name: "Adventure", slug: "adventure", group: "activity" } }),
    db.tags.create({ data: { name: "Family",    slug: "family",    group: "type"     } }),
    db.tags.create({ data: { name: "Honeymoon", slug: "honeymoon", group: "type"     } }),
    db.tags.create({ data: { name: "Budget",    slug: "budget",    group: "budget"   } }),
    db.tags.create({ data: { name: "Luxury",    slug: "luxury",    group: "budget"   } }),
    db.tags.create({ data: { name: "Summer",    slug: "summer",    group: "season"   } }),
  ]);
  console.log("✅ Categories: 4 | Tags: 7");

  // ════════════════════════════════════════════════════════════════════════
  // 3. PRICING RULES
  // ════════════════════════════════════════════════════════════════════════

  await db.pricing_rules.createMany({
    data: [
      { name: "Platform Commission",   type: "percentage", value: 12, applies_to: "all",      is_active: true  },
      { name: "Hotel Markup",          type: "percentage", value: 8,  applies_to: "hotel",    is_active: true  },
      { name: "Activity Markup",       type: "percentage", value: 10, applies_to: "activity", is_active: true  },
      { name: "GST",                   type: "percentage", value: 5,  applies_to: "all",      is_active: true  },
      { name: "Peak Season Surcharge", type: "percentage", value: 20, applies_to: "hotel",    is_active: false },
    ]
  });
  console.log("✅ Pricing rules: 5");

  // ════════════════════════════════════════════════════════════════════════
  // 4. HOTELS
  // ════════════════════════════════════════════════════════════════════════

  const hotelNehru = await db.hotels.create({ data: { name: "Hotel Nehru Palace",        slug: "hotel-nehru-palace",        destination_id: kashmir.id,  star_rating: 5, category: "hotel",     description: "Luxury 5-star hotel overlooking Dal Lake.",          address: "Boulevard Road, Dal Lake, Srinagar",    check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","pool","spa","restaurant","parking","gym"]            } });
  const hotelGrand = await db.hotels.create({ data: { name: "Grand Houseboat Srinagar",   slug: "grand-houseboat-srinagar",  destination_id: kashmir.id,  star_rating: 4, category: "houseboat", description: "Traditional Kashmiri cedar wood houseboat on Dal Lake.", address: "Nagin Lake, Boulevard Road, Srinagar",  check_in_time: "13:00", check_out_time: "10:00", amenities: ["wifi","restaurant","shikara-ride","lake-view"]             } });
  const hotelDal   = await db.hotels.create({ data: { name: "Dal View Resort",            slug: "dal-view-resort",           destination_id: kashmir.id,  star_rating: 3, category: "resort",    description: "Budget-friendly resort with Dal Lake views.",           address: "Nagin Lake Road, Srinagar",            check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","restaurant","parking","lake-view"]                  } });
  const hotelManu  = await db.hotels.create({ data: { name: "Hotel Manuallaya Manali",    slug: "hotel-manuallaya-manali",   destination_id: himachal.id, star_rating: 4, category: "resort",    description: "Riverside resort in deodar forests of Manali.",          address: "Old Manali Road, Manali, HP",          check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","spa","restaurant","bonfire","mountain-view"]        } });
  const hotelSnow  = await db.hotels.create({ data: { name: "Snow Valley Resort Shimla",  slug: "snow-valley-resort-shimla", destination_id: himachal.id, star_rating: 3, category: "hotel",     description: "Heritage colonial property on the Shimla Ridge.",        address: "The Ridge, Shimla, HP",               check_in_time: "13:00", check_out_time: "12:00", amenities: ["wifi","restaurant","valley-view","parking"]                } });
  console.log("✅ Hotels: 5");

  // ── Hotel image categories ───────────────────────────────────────────────
  async function seedHotelCategories(hotelId: number) {
    const cats = await db.hotel_image_categories.createManyAndReturn({
      data: ALL_SYSTEM_HOTEL_CATEGORIES.map((cat, i) => ({
        hotel_id:        hotelId,
        room_pricing_id: null,
        name:            cat.name,
        is_required:     cat.is_required,
        is_system:       cat.is_system,
        sort_order:      i,
      })),
    });
    return {
      facade: cats.find(c => c.name === "Facade / Exterior")!,
      lobby:  cats.find(c => c.name === "Lobby / Reception")!,
    };
  }

  const nehruCats = await seedHotelCategories(hotelNehru.id);
  const grandCats = await seedHotelCategories(hotelGrand.id);
  const dalCats   = await seedHotelCategories(hotelDal.id);
  const manuCats  = await seedHotelCategories(hotelManu.id);
  const snowCats  = await seedHotelCategories(hotelSnow.id);
  console.log("✅ Hotel image categories created");

  // ── Room pricing ─────────────────────────────────────────────────────────
  await db.hotel_room_pricing.createMany({
    data: [
      { hotel_id: hotelNehru.id, room_type: "Deluxe",         description: "Dal Lake view room with balcony",   occupancy: 2, price_per_night: 9000,  original_price: 11000, margin_percentage: 18, season: "all", amenities: ["AC","TV","lake-view","balcony"],  sort_order: 1 },
      { hotel_id: hotelNehru.id, room_type: "Suite",          description: "Luxury suite with jacuzzi",         occupancy: 2, price_per_night: 18000, original_price: 22000, margin_percentage: 25, season: "all", amenities: ["AC","TV","jacuzzi","butler"],     sort_order: 2 },
      { hotel_id: hotelGrand.id, room_type: "Standard Cabin", description: "Traditional cedar cabin on Dal",    occupancy: 2, price_per_night: 4500,  original_price: 5500,  margin_percentage: 12, season: "all", amenities: ["AC","TV","lake-view"],           sort_order: 1 },
      { hotel_id: hotelGrand.id, room_type: "Deluxe Cabin",   description: "Premium cabin with sit-out deck",   occupancy: 2, price_per_night: 7000,  original_price: 8500,  margin_percentage: 20, season: "all", amenities: ["AC","TV","lake-view","deck"],     sort_order: 2 },
      { hotel_id: hotelDal.id,   room_type: "Standard",       description: "Clean comfortable room",            occupancy: 2, price_per_night: 2500,  original_price: 3200,  margin_percentage: 10, season: "all", amenities: ["AC","TV"],                       sort_order: 1 },
      { hotel_id: hotelDal.id,   room_type: "Deluxe",         description: "Room with partial lake view",       occupancy: 2, price_per_night: 3500,  original_price: 4500,  margin_percentage: 15, season: "all", amenities: ["AC","TV","lake-view"],           sort_order: 2 },
      { hotel_id: hotelManu.id,  room_type: "Deluxe",         description: "Forest view room with balcony",     occupancy: 2, price_per_night: 6500,  original_price: 8000,  margin_percentage: 18, season: "all", amenities: ["heater","TV","forest-view","balcony"], sort_order: 1 },
      { hotel_id: hotelManu.id,  room_type: "Suite",          description: "River view suite with jacuzzi",     occupancy: 2, price_per_night: 12000, original_price: 15000, margin_percentage: 22, season: "all", amenities: ["heater","TV","river-view","jacuzzi"],  sort_order: 2 },
      { hotel_id: hotelSnow.id,  room_type: "Standard",       description: "Comfortable room city view",        occupancy: 2, price_per_night: 2800,  original_price: 3500,  margin_percentage: 10, season: "all", amenities: ["heater","TV"],                   sort_order: 1 },
      { hotel_id: hotelSnow.id,  room_type: "Deluxe",         description: "Valley view room with balcony",     occupancy: 2, price_per_night: 4500,  original_price: 5800,  margin_percentage: 15, season: "all", amenities: ["heater","TV","valley-view"],     sort_order: 2 },
    ],
  });
  console.log("✅ Hotel room pricing: 10 rows");

  // ── Hotel images ─────────────────────────────────────────────────────────
  await db.hotel_images.createMany({
    data: [
      { hotel_id: hotelNehru.id, category_id: nehruCats.facade.id, url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200", thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", alt: "Hotel Nehru Palace exterior", sort_order: 1, is_primary: true  },
      { hotel_id: hotelNehru.id, category_id: nehruCats.lobby.id,  url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200", thumbnail: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", alt: "Nehru Palace lobby",          sort_order: 1, is_primary: false },
      { hotel_id: hotelGrand.id, category_id: grandCats.facade.id, url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Grand Houseboat exterior",    sort_order: 1, is_primary: true  },
      { hotel_id: hotelGrand.id, category_id: grandCats.lobby.id,  url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Houseboat interior",          sort_order: 1, is_primary: false },
      { hotel_id: hotelDal.id,   category_id: dalCats.facade.id,   url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200", thumbnail: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400", alt: "Dal View Resort",             sort_order: 1, is_primary: true  },
      { hotel_id: hotelManu.id,  category_id: manuCats.facade.id,  url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Manuallaya exterior",         sort_order: 1, is_primary: true  },
      { hotel_id: hotelManu.id,  category_id: manuCats.lobby.id,   url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200", thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400", alt: "Manuallaya mountain",         sort_order: 1, is_primary: false },
      { hotel_id: hotelSnow.id,  category_id: snowCats.facade.id,  url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200", thumbnail: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400", alt: "Snow Valley exterior",        sort_order: 1, is_primary: true  },
    ],
  });
  console.log("✅ Hotel images: 8");

  // ════════════════════════════════════════════════════════════════════════
  // 5. ACTIVITIES
  // ════════════════════════════════════════════════════════════════════════

  const actShikara = await db.activities.create({ data: { name: "Dal Lake Shikara Ride",  slug: "dal-lake-shikara-ride",  destination_id: kashmir.id,  duration_hours: 2, difficulty: "easy",     category: "sightseeing", price: 800,  original_price: 1000, margin_percentage: 12, pricing_type: "per_person", min_persons: 1, description: "Traditional shikara boat ride on iconic Dal Lake.",    meta_title: "Dal Lake Shikara Ride | Dreams Yatri", meta_desc: "Book shikara ride in Srinagar."           } });
  const actGondola = await db.activities.create({ data: { name: "Gulmarg Gondola Ride",   slug: "gulmarg-gondola-ride",   destination_id: kashmir.id,  duration_hours: 3, difficulty: "easy",     category: "adventure",   price: 1500, original_price: 1800, margin_percentage: 15, pricing_type: "per_person", min_persons: 1, description: "Asia's highest gondola with Himalayan views.",         meta_title: "Gulmarg Gondola | Dreams Yatri",       meta_desc: "Book Gulmarg Gondola Phase 1 and 2."     } });
  const actSkiing  = await db.activities.create({ data: { name: "Skiing at Gulmarg",      slug: "skiing-at-gulmarg",      destination_id: kashmir.id,  duration_hours: 5, difficulty: "moderate", category: "adventure",   price: 3000, original_price: 4000, margin_percentage: 18, pricing_type: "per_person", min_persons: 1, description: "World-class skiing on Gulmarg's Himalayan slopes.",    meta_title: "Skiing Gulmarg | Dreams Yatri",        meta_desc: "Book skiing at Gulmarg."                 } });
  const actMughal  = await db.activities.create({ data: { name: "Mughal Gardens Tour",    slug: "mughal-gardens-tour",    destination_id: kashmir.id,  duration_hours: 4, difficulty: "easy",     category: "sightseeing", price: 600,  original_price: 800,  margin_percentage: 12, pricing_type: "per_person", min_persons: 1, description: "Guided tour of Shalimar Bagh, Nishat Bagh.",          meta_title: "Mughal Gardens Tour | Dreams Yatri",   meta_desc: "Book Mughal gardens tour."               } });
  const actKufri   = await db.activities.create({ data: { name: "Kufri Snow Activities",  slug: "kufri-snow-activities",  destination_id: himachal.id, duration_hours: 4, difficulty: "easy",     category: "adventure",   price: 1500, original_price: 1800, margin_percentage: 15, pricing_type: "per_person", min_persons: 1, description: "Snow activities at Kufri — skiing, yak rides.",        meta_title: "Kufri Snow Activities | Dreams Yatri", meta_desc: "Book Kufri snow activities."              } });
  const actRohtang = await db.activities.create({ data: { name: "Rohtang Pass Day Trip",  slug: "rohtang-pass-day-trip",  destination_id: himachal.id, duration_hours: 8, difficulty: "easy",     category: "sightseeing", price: 2500, original_price: 3200, margin_percentage: 15, pricing_type: "per_person", min_persons: 1, description: "Full day excursion to Rohtang Pass at 3978m.",        meta_title: "Rohtang Pass Trip | Dreams Yatri",     meta_desc: "Book Rohtang Pass excursion."             } });
  console.log("✅ Activities: 6");

  await db.activity_images.createMany({
    data: [
      { activity_id: actShikara.id, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200", thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", alt: "Dal Lake Shikara", sort_order: 1, is_primary: true  },
      { activity_id: actShikara.id, url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200", thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400", alt: "Dal Lake morning", sort_order: 2, is_primary: false },
      { activity_id: actGondola.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200", thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400", alt: "Gulmarg Gondola",  sort_order: 1, is_primary: true  },
      { activity_id: actGondola.id, url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Gulmarg snow",    sort_order: 2, is_primary: false },
      { activity_id: actSkiing.id,  url: "https://images.unsplash.com/photo-1551524164-6cf2ac2f4d7b?w=1200", thumbnail: "https://images.unsplash.com/photo-1551524164-6cf2ac2f4d7b?w=400", alt: "Skiing Gulmarg",  sort_order: 1, is_primary: true  },
      { activity_id: actMughal.id,  url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Mughal Gardens",  sort_order: 1, is_primary: true  },
      { activity_id: actKufri.id,   url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Kufri snow",      sort_order: 1, is_primary: true  },
      { activity_id: actRohtang.id, url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Rohtang Pass",    sort_order: 1, is_primary: true  },
    ]
  });
  console.log("✅ Activity images: 8");

  // ════════════════════════════════════════════════════════════════════════
  // 6. PACKAGE 1 — Kashmir Grand Tour
  // ════════════════════════════════════════════════════════════════════════

  const pkg1 = await db.packages.create({
    data: {
      title: "Kashmir Grand Tour", slug: "kashmir-grand-tour", destination_id: kashmir.id,
      description: "Paradise on earth — houseboat stays on Dal Lake, snow adventures in Gulmarg and verdant valleys of Pahalgam.",
      meta_title: "Kashmir Grand Tour | Dreams Yatri", meta_desc: "Book Kashmir Grand Tour — Dal Lake, Gulmarg and Pahalgam. From ₹14,999.",
      thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
      cover_image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920", is_active: true,
    }
  });

  const [p1s1, p1s2, p1s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg1.id, slug: "standard",     label: "Standard",     description: "3-star hotels and houseboats",        sort_order: 1, is_default: false } }),
    db.package_stay_categories.create({ data: { package_id: pkg1.id, slug: "deluxe",       label: "Deluxe",       description: "4-star hotels with Dal Lake views",   sort_order: 2, is_default: true  } }),
    db.package_stay_categories.create({ data: { package_id: pkg1.id, slug: "super-deluxe", label: "Super Deluxe", description: "5-star luxury stays",                 sort_order: 3, is_default: false, min_duration_days: 5 } }),
  ]);

  const p1d4 = await db.package_durations.create({
    data: {
      package_id: pkg1.id, slug: "4-days", label: "4 Days / 3 Nights", days: 4, nights: 3, is_default: false, sort_order: 1,
      meta_title: "Kashmir 4 Days Package | Dreams Yatri", meta_desc: "Short Kashmir trip — Srinagar and Pahalgam.",
      routes: [{ id: 0, slug: "route-0", label: "Srinagar → Pahalgam → Srinagar", is_default: true, stops: [{ p: "Srinagar", d: 2 }, { p: "Pahalgam", d: 1 }, { p: "Srinagar", d: 1 }] }],
    }
  });

  const p1d6 = await db.package_durations.create({
    data: {
      package_id: pkg1.id, slug: "6-days", label: "6 Days / 5 Nights", days: 6, nights: 5, is_default: true, sort_order: 2,
      meta_title: "Kashmir 6 Days Package | Dreams Yatri", meta_desc: "Most popular Kashmir tour — Srinagar, Gulmarg and Pahalgam.",
      routes: [
        { id: 0, slug: "route-0", label: "Srinagar → Gulmarg → Pahalgam → Srinagar",          is_default: true,  stops: [{ p: "Srinagar", d: 2 }, { p: "Gulmarg", d: 1 }, { p: "Pahalgam", d: 1 }, { p: "Srinagar", d: 1 }] },
        { id: 1, slug: "route-1", label: "Srinagar → Gulmarg → Pahalgam → Sonmarg → Srinagar", is_default: false, stops: [{ p: "Srinagar", d: 1 }, { p: "Gulmarg", d: 1 }, { p: "Pahalgam", d: 1 }, { p: "Sonmarg", d: 1 }, { p: "Srinagar", d: 1 }] },
      ],
    }
  });

  await db.package_pricing.createMany({
    data: [
      { package_id: pkg1.id, duration_id: p1d4.id, route_index: 0, stay_category_id: p1s1.id, price: 14999, original_price: 17999 },
      { package_id: pkg1.id, duration_id: p1d4.id, route_index: 0, stay_category_id: p1s2.id, price: 19999, original_price: 23999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s1.id, price: 24999, original_price: 29999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s2.id, price: 32999, original_price: 38999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s3.id, price: 44999, original_price: 52999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s1.id, price: 27999, original_price: 32999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s2.id, price: 35999, original_price: 42999 },
      { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s3.id, price: 47999, original_price: 55999 },
    ]
  });

  await db.package_itineraries.createMany({
    data: [
      // 4-day
      { package_id: pkg1.id, duration_id: p1d4.id, day: 1, route_index: null, hotel_id: hotelGrand.id, hotel_days: 2, title: "Arrival in Srinagar",     description: "Arrive at Srinagar airport. Transfer to Dal Lake houseboat. Evening shikara.", activity_ids: [actShikara.id], activities: ["Airport pickup", "Dal Lake shikara ride", "Houseboat check-in"],              meals: ["Dinner"]              },
      { package_id: pkg1.id, duration_id: p1d4.id, day: 2, route_index: null, hotel_id: hotelDal.id,   hotel_days: 2, title: "Pahalgam Excursion",       description: "Drive to Pahalgam — the Valley of Shepherds.",                                  activity_ids: [],              activities: ["Betaab Valley", "Aru Valley", "Baisaran meadows"],                          meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d4.id, day: 3, route_index: null, hotel_id: hotelGrand.id, hotel_days: 3, title: "Srinagar Sightseeing",     description: "Explore heritage Srinagar — Mughal gardens and temples.",                       activity_ids: [actMughal.id],  activities: ["Mughal Gardens", "Shankaracharya Temple", "Old City walk"],                  meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d4.id, day: 4, route_index: null, hotel_id: null,          hotel_days: 1, title: "Departure",                description: "Post-breakfast check out and airport transfer.",                               activity_ids: [],              activities: ["Breakfast", "Airport transfer"],                                             meals: ["Breakfast"]           },
      // 6-day route-0
      { package_id: pkg1.id, duration_id: p1d6.id, day: 1, route_index: 0,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Arrival in Srinagar",     description: "Arrive at Srinagar airport. Transfer to Dal Lake houseboat. Evening shikara.", activity_ids: [actShikara.id], activities: ["Airport pickup", "Dal Lake shikara ride", "Houseboat check-in"],              meals: ["Dinner"]              },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 2, route_index: 0,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Gulmarg Day Trip",         description: "Full day at Gulmarg — gondola ride Phase 1 and 2, snow activities.",           activity_ids: [actGondola.id, actSkiing.id], activities: ["Gondola Phase 1+2", "Snow activities", "Skiing option"],             meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 3, route_index: 0,    hotel_id: hotelDal.id,   hotel_days: 5, title: "Pahalgam",                 description: "Scenic drive through apple orchards to the Valley of Shepherds.",              activity_ids: [],              activities: ["Betaab Valley", "Aru Valley", "Baisaran meadows"],                          meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 4, route_index: 0,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Srinagar Sightseeing",     description: "Explore heritage Srinagar — Mughal gardens, temples and old city.",           activity_ids: [actMughal.id],  activities: ["Mughal Gardens", "Shankaracharya Temple", "Hazratbal Shrine"],               meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 5, route_index: 0,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Leisure & Shopping",       description: "Free day — Pashmina shopping, Wazwan lunch, sunset shikara.",               activity_ids: [actShikara.id], activities: ["Pashmina shopping", "Wazwan lunch", "Sunset shikara"],                       meals: ["Breakfast"]           },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 6, route_index: 0,    hotel_id: null,          hotel_days: 1, title: "Departure",                description: "Post-breakfast check out and transfer to airport.",                            activity_ids: [],              activities: ["Breakfast", "Airport transfer"],                                             meals: ["Breakfast"]           },
      // 6-day route-1
      { package_id: pkg1.id, duration_id: p1d6.id, day: 1, route_index: 1,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Arrival in Srinagar",     description: "Arrive at Srinagar airport. Transfer to Dal Lake houseboat. Evening shikara.", activity_ids: [actShikara.id], activities: ["Airport pickup", "Dal Lake shikara ride", "Houseboat check-in"],              meals: ["Dinner"]              },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 2, route_index: 1,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Gulmarg Day Trip",         description: "Full day at Gulmarg — gondola and snow activities.",                          activity_ids: [actGondola.id], activities: ["Gondola Phase 1+2", "Snow activities"],                                      meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 3, route_index: 1,    hotel_id: hotelDal.id,   hotel_days: 5, title: "Pahalgam",                 description: "Scenic drive to the Valley of Shepherds.",                                     activity_ids: [],              activities: ["Betaab Valley", "Aru Valley", "Baisaran meadows"],                          meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 4, route_index: 1,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Sonmarg Day Trip",         description: "Visit Sonmarg — the Meadow of Gold at 2730m. Thajiwas Glacier.",            activity_ids: [],              activities: ["Thajiwas Glacier", "Sindh River walk", "Pony ride option"],                  meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 5, route_index: 1,    hotel_id: hotelGrand.id, hotel_days: 5, title: "Srinagar Sightseeing",     description: "Explore Srinagar's heritage gardens and shrines.",                            activity_ids: [actMughal.id],  activities: ["Mughal Gardens", "Shankaracharya Temple", "Old bazaar"],                     meals: ["Breakfast","Dinner"]   },
      { package_id: pkg1.id, duration_id: p1d6.id, day: 6, route_index: 1,    hotel_id: null,          hotel_days: 1, title: "Departure",                description: "Post-breakfast check out and transfer to airport.",                            activity_ids: [],              activities: ["Breakfast", "Airport transfer"],                                             meals: ["Breakfast"]           },
    ]
  });

  await db.package_images.createMany({
    data: [
      { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Dal Lake Srinagar",  sort_order: 1, is_primary: true  },
      { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200", thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400", alt: "Gulmarg snow",       sort_order: 2, is_primary: false },
      { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200", thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400", alt: "Pahalgam valley",   sort_order: 3, is_primary: false },
      { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Mughal Garden",     sort_order: 4, is_primary: false },
      { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200", thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", alt: "Shikara Dal Lake",  sort_order: 5, is_primary: false },
    ]
  });
  await db.package_hotels.createMany({ data: [
    { package_id: pkg1.id, hotel_id: hotelDal.id,   stay_category_id: p1s1.id, is_recommended: false },
    { package_id: pkg1.id, hotel_id: hotelGrand.id,  stay_category_id: p1s2.id, is_recommended: true  },
    { package_id: pkg1.id, hotel_id: hotelNehru.id,  stay_category_id: p1s3.id, is_recommended: true  },
  ]});
  await db.package_activities.createMany({ data: [
    { package_id: pkg1.id, activity_id: actShikara.id, duration_id: p1d6.id, day_number: 1, is_optional: false },
    { package_id: pkg1.id, activity_id: actGondola.id, duration_id: p1d6.id, day_number: 2, is_optional: false },
    { package_id: pkg1.id, activity_id: actSkiing.id,  duration_id: p1d6.id, day_number: 2, is_optional: true, extra_price: 3000 },
    { package_id: pkg1.id, activity_id: actMughal.id,  duration_id: p1d6.id, day_number: 4, is_optional: false },
  ]});
  await db.package_tags.createMany({ data: [
    { package_id: pkg1.id, tag_id: tagSnow.id }, { package_id: pkg1.id, tag_id: tagAdventure.id },
    { package_id: pkg1.id, tag_id: tagFamily.id }, { package_id: pkg1.id, tag_id: tagHoneymoon.id },
    { package_id: pkg1.id, tag_id: tagLuxury.id },
  ]});
  await db.package_categories.createMany({ data: [
    { package_id: pkg1.id, category_id: catHill.id },
    { package_id: pkg1.id, category_id: catHoneymoon.id },
    { package_id: pkg1.id, category_id: catAdventure.id },
  ]});
  console.log("✅ Package 1: Kashmir Grand Tour");

  // ════════════════════════════════════════════════════════════════════════
  // 7. PACKAGE 2 — Shimla Manali Classic
  // ════════════════════════════════════════════════════════════════════════

  const pkg2 = await db.packages.create({
    data: {
      title: "Shimla Manali Classic", slug: "shimla-manali-classic", destination_id: himachal.id,
      description: "The classic Himachal circuit — colonial Shimla, Kufri snow, Solang Valley and scenic Manali.",
      meta_title: "Shimla Manali Tour Package | Dreams Yatri", meta_desc: "Book Shimla Manali Classic — Kufri, Solang and Rohtang Pass. From ₹12,999.",
      thumbnail: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=400",
      cover_image: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=1920", is_active: true,
    }
  });

  const [p2s1, p2s2] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg2.id, slug: "standard", label: "Standard", description: "2-3 star hotels",                       sort_order: 1, is_default: false } }),
    db.package_stay_categories.create({ data: { package_id: pkg2.id, slug: "deluxe",   label: "Deluxe",   description: "4-star properties with mountain views", sort_order: 2, is_default: true  } }),
  ]);

  const p2d5 = await db.package_durations.create({
    data: {
      package_id: pkg2.id, slug: "5-days", label: "5 Days / 4 Nights", days: 5, nights: 4, is_default: false, sort_order: 1,
      meta_title: "Shimla Manali 5 Days | Dreams Yatri", meta_desc: "Quick Shimla Manali trip in 5 days.",
      routes: [{ id: 0, slug: "route-0", label: "Chandigarh → Shimla → Manali → Chandigarh", is_default: true, stops: [{ p: "Chandigarh", d: 1 }, { p: "Shimla", d: 2 }, { p: "Manali", d: 1 }, { p: "Chandigarh", d: 1 }] }],
    }
  });

  const p2d7 = await db.package_durations.create({
    data: {
      package_id: pkg2.id, slug: "7-days", label: "7 Days / 6 Nights", days: 7, nights: 6, is_default: true, sort_order: 2,
      meta_title: "Shimla Manali 7 Days | Dreams Yatri", meta_desc: "Most popular Shimla Manali tour.",
      routes: [
        { id: 0, slug: "route-0", label: "Chandigarh → Shimla → Kufri → Manali → Chandigarh", is_default: true,  stops: [{ p: "Chandigarh", d: 1 }, { p: "Shimla", d: 2 }, { p: "Kufri", d: 1 }, { p: "Manali", d: 2 }, { p: "Chandigarh", d: 1 }] },
        { id: 1, slug: "route-1", label: "Delhi → Shimla → Kufri → Manali → Delhi",           is_default: false, stops: [{ p: "Delhi", d: 1 },       { p: "Shimla", d: 2 }, { p: "Kufri", d: 1 }, { p: "Manali", d: 2 }, { p: "Delhi", d: 1 }]       },
      ],
    }
  });

  await db.package_pricing.createMany({
    data: [
      { package_id: pkg2.id, duration_id: p2d5.id, route_index: 0, stay_category_id: p2s1.id, price: 12999, original_price: 15999 },
      { package_id: pkg2.id, duration_id: p2d5.id, route_index: 0, stay_category_id: p2s2.id, price: 17999, original_price: 21999 },
      { package_id: pkg2.id, duration_id: p2d7.id, route_index: 0, stay_category_id: p2s1.id, price: 18999, original_price: 22999 },
      { package_id: pkg2.id, duration_id: p2d7.id, route_index: 0, stay_category_id: p2s2.id, price: 25999, original_price: 30999 },
      { package_id: pkg2.id, duration_id: p2d7.id, route_index: 1, stay_category_id: p2s1.id, price: 21999, original_price: 25999 },
      { package_id: pkg2.id, duration_id: p2d7.id, route_index: 1, stay_category_id: p2s2.id, price: 28999, original_price: 34999 },
    ]
  });

  await db.package_itineraries.createMany({
    data: [
      // 5-day
      { package_id: pkg2.id, duration_id: p2d5.id, day: 1, route_index: null, hotel_id: hotelSnow.id, hotel_days: 2, title: "Chandigarh to Shimla",    description: "Pickup from Chandigarh, scenic drive to Shimla. Mall Road evening.",       activity_ids: [],            activities: ["Chandigarh pickup", "Mall Road walk", "Check-in"],                       meals: ["Dinner"]            },
      { package_id: pkg2.id, duration_id: p2d5.id, day: 2, route_index: null, hotel_id: hotelSnow.id, hotel_days: 2, title: "Shimla & Kufri",          description: "Snow activities at Kufri and Shimla sightseeing.",                          activity_ids: [actKufri.id], activities: ["Kufri snow activities", "Jakhu Temple", "Christ Church", "Mall Road"],  meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d5.id, day: 3, route_index: null, hotel_id: hotelManu.id, hotel_days: 2, title: "Shimla to Manali",         description: "Scenic drive through Kullu Valley to Manali.",                              activity_ids: [],            activities: ["Kullu Valley drive", "Kullu Maidan stop", "Manali check-in"],            meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d5.id, day: 4, route_index: null, hotel_id: hotelManu.id, hotel_days: 2, title: "Manali Sightseeing",       description: "Hadimba Temple, Vashisht hot springs, Tibetan market.",                    activity_ids: [],            activities: ["Hadimba Temple", "Vashisht hot springs", "Tibetan market"],               meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d5.id, day: 5, route_index: null, hotel_id: null,         hotel_days: null, title: "Departure from Manali", description: "Post-breakfast check out. Drop to Chandigarh.",                            activity_ids: [],            activities: ["Breakfast", "Drop to Chandigarh"],                                        meals: ["Breakfast"]          },
      // 7-day route-0
      { package_id: pkg2.id, duration_id: p2d7.id, day: 1, route_index: 0, hotel_id: hotelSnow.id, hotel_days: 2, title: "Chandigarh to Shimla",       description: "Pickup from Chandigarh, scenic drive to Shimla.",                          activity_ids: [],              activities: ["Chandigarh pickup", "Mall Road walk", "Check-in"],                     meals: ["Dinner"]            },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 2, route_index: 0, hotel_id: hotelSnow.id, hotel_days: 2, title: "Shimla & Kufri",             description: "Snow activities at Kufri and Shimla sightseeing.",                          activity_ids: [actKufri.id],   activities: ["Kufri snow activities", "Jakhu Temple", "Christ Church", "Mall Road"],  meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 3, route_index: 0, hotel_id: hotelManu.id, hotel_days: 2, title: "Shimla to Manali",           description: "Scenic drive through Kullu Valley.",                                        activity_ids: [],              activities: ["Kullu Valley drive", "Kullu stop", "Manali check-in"],                 meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 4, route_index: 0, hotel_id: hotelManu.id, hotel_days: 2, title: "Solang Valley",              description: "Adventure day — ropeway, zorbing, snow activities.",                        activity_ids: [],              activities: ["Solang Valley ropeway", "Snow activities", "Zorbing"],                 meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 5, route_index: 0, hotel_id: hotelManu.id, hotel_days: 2, title: "Manali Sightseeing",         description: "Hadimba Temple, Vashisht hot springs, Tibetan market.",                    activity_ids: [],              activities: ["Hadimba Temple", "Vashisht hot springs", "Tibetan market"],             meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 6, route_index: 0, hotel_id: hotelManu.id, hotel_days: 2, title: "Rohtang Pass Excursion",     description: "Day excursion to Rohtang Pass at 3978m.",                                  activity_ids: [actRohtang.id], activities: ["Rohtang Pass", "Snow photography", "Yak ride"],                        meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 7, route_index: 0, hotel_id: null,         hotel_days: null, title: "Departure from Manali",   description: "Post-breakfast check out. Drop to Chandigarh.",                            activity_ids: [],              activities: ["Breakfast", "Drop to Chandigarh"],                                      meals: ["Breakfast"]          },
      // 7-day route-1
      { package_id: pkg2.id, duration_id: p2d7.id, day: 1, route_index: 1, hotel_id: hotelSnow.id, hotel_days: 2, title: "Delhi to Shimla",            description: "Drive from Delhi via Kalka to Shimla.",                                    activity_ids: [],              activities: ["Delhi pickup", "Kalka-Shimla drive", "Check-in"],                      meals: ["Dinner"]            },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 2, route_index: 1, hotel_id: hotelSnow.id, hotel_days: 2, title: "Shimla & Kufri",             description: "Snow activities at Kufri and Shimla sightseeing.",                          activity_ids: [actKufri.id],   activities: ["Kufri snow activities", "Jakhu Temple", "Christ Church"],              meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 3, route_index: 1, hotel_id: hotelManu.id, hotel_days: 2, title: "Shimla to Manali",           description: "Drive through Kullu Valley to Manali.",                                    activity_ids: [],              activities: ["Kullu Valley drive", "Manali check-in"],                               meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 4, route_index: 1, hotel_id: hotelManu.id, hotel_days: 2, title: "Solang Valley",              description: "Adventure day at Solang Valley.",                                          activity_ids: [],              activities: ["Solang Valley ropeway", "Snow activities", "Zorbing"],                 meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 5, route_index: 1, hotel_id: hotelManu.id, hotel_days: 2, title: "Manali Sightseeing",         description: "Hadimba Temple, Vashisht springs, Tibetan market.",                       activity_ids: [],              activities: ["Hadimba Temple", "Vashisht hot springs", "Tibetan market"],             meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 6, route_index: 1, hotel_id: hotelManu.id, hotel_days: 2, title: "Rohtang Pass Excursion",     description: "Day excursion to Rohtang Pass at 3978m.",                                  activity_ids: [actRohtang.id], activities: ["Rohtang Pass", "Snow photography", "Yak ride"],                        meals: ["Breakfast","Dinner"] },
      { package_id: pkg2.id, duration_id: p2d7.id, day: 7, route_index: 1, hotel_id: null,         hotel_days: null, title: "Departure to Delhi",       description: "Post-breakfast check out. Drive back to Delhi.",                           activity_ids: [],              activities: ["Breakfast", "Drive to Delhi"],                                          meals: ["Breakfast"]          },
    ]
  });

  await db.package_images.createMany({
    data: [
      { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=1200", thumbnail: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=400", alt: "Manali snow",    sort_order: 1, is_primary: true  },
      { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Solang Valley", sort_order: 2, is_primary: false },
      { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Rohtang Pass",  sort_order: 3, is_primary: false },
      { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200", thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400", alt: "Kufri snow",    sort_order: 4, is_primary: false },
    ]
  });
  await db.package_hotels.createMany({ data: [
    { package_id: pkg2.id, hotel_id: hotelSnow.id, stay_category_id: p2s1.id, is_recommended: false },
    { package_id: pkg2.id, hotel_id: hotelManu.id, stay_category_id: p2s2.id, is_recommended: true  },
  ]});
  await db.package_activities.createMany({ data: [
    { package_id: pkg2.id, activity_id: actKufri.id,   duration_id: p2d7.id, day_number: 2, is_optional: false },
    { package_id: pkg2.id, activity_id: actRohtang.id, duration_id: p2d7.id, day_number: 6, is_optional: false },
  ]});
  await db.package_tags.createMany({ data: [
    { package_id: pkg2.id, tag_id: tagSnow.id }, { package_id: pkg2.id, tag_id: tagAdventure.id },
    { package_id: pkg2.id, tag_id: tagFamily.id }, { package_id: pkg2.id, tag_id: tagBudget.id },
    { package_id: pkg2.id, tag_id: tagSummer.id },
  ]});
  await db.package_categories.createMany({ data: [
    { package_id: pkg2.id, category_id: catHill.id },
    { package_id: pkg2.id, category_id: catAdventure.id },
  ]});
  console.log("✅ Package 2: Shimla Manali Classic");

  // ════════════════════════════════════════════════════════════════════════
  // 8. TEST USER + BOOKINGS + PAYMENTS
  // ════════════════════════════════════════════════════════════════════════

// ── Vikrant test user with full profile data ─────────────────────────
const vikrant = await db.user.upsert({
  where:  { email: "thakurvikrant975@gmail.com" },
  update: {
    name:              "Vikrant Thakur",
    phone:             "9816012345",
    country_code:      "+91",
    emailVerified:     new Date(),
    gender:            "MALE",
    dateOfBirth:       new Date("1990-03-22"),
    nationality:       "Indian",
    state:             "Himachal Pradesh",
    city:              "Shimla",
    isProfileComplete: true,
    status:            "ACTIVE",
    role:              "USER",
  },
  create: {
    email:             "thakurvikrant975@gmail.com",
    name:              "Vikrant Thakur",
    phone:             "9816012345",
    country_code:      "+91",
    emailVerified:     new Date(),
    gender:            "MALE",
    dateOfBirth:       new Date("1990-03-22"),
    nationality:       "Indian",
    state:             "Himachal Pradesh",
    city:              "Shimla",
    isProfileComplete: true,
    status:            "ACTIVE",
    role:              "USER",
  },
});
console.log(`✅ Vikrant: ${vikrant.email} (${vikrant.id})`);

// ── Travel preferences ───────────────────────────────────────────────
await db.travelPreference.upsert({
  where:  { userId: vikrant.id },
  update: {},
  create: {
    userId:    vikrant.id,
    tripTypes: ["Adventure", "Honeymoon"],
    groupType: "Couple",
    budget:    "Luxury",
    duration:  "Week",
    months:    ["May", "Jun", "Oct"],
  },
});
console.log("✅ Vikrant travel preferences");

// ── Bookings ─────────────────────────────────────────────────────────
const vb1 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2024-001", destinationId: kashmir.id,  tripType: "Honeymoon",  startDate: new Date("2024-04-10"), endDate: new Date("2024-04-17"), duration: 7, travellers: 2, status: "COMPLETED", totalAmount: 85000,  paidAmount: 85000  } });
const vb2 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2024-002", destinationId: himachal.id, tripType: "Adventure",  startDate: new Date("2024-10-05"), endDate: new Date("2024-10-12"), duration: 7, travellers: 3, status: "COMPLETED", totalAmount: 55000,  paidAmount: 55000  } });
const vb3 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2025-001", destinationId: goa.id,      tripType: "Leisure",    startDate: new Date("2025-01-15"), endDate: new Date("2025-01-20"), duration: 5, travellers: 4, status: "COMPLETED", totalAmount: 42000,  paidAmount: 42000  } });
const vb4 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2025-002", destinationId: himachal.id, tripType: "Family",     startDate: new Date("2025-06-01"), endDate: new Date("2025-06-06"), duration: 5, travellers: 5, status: "CANCELLED", totalAmount: 65000,  paidAmount: 32500,  cancelledAt: new Date("2025-05-01"), cancelReason: "Weather concerns" } });
const vb5 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2026-001", destinationId: kashmir.id,  tripType: "Adventure",  startDate: new Date("2026-05-20"), endDate: new Date("2026-05-27"), duration: 7, travellers: 2, status: "UPCOMING",  totalAmount: 95000,  paidAmount: 47500  } });
const vb6 = await db.booking.create({ data: { userId: vikrant.id, bookingNumber: "DY-V-2026-002", destinationId: himachal.id, tripType: "Honeymoon",  startDate: new Date("2026-08-10"), endDate: new Date("2026-08-17"), duration: 7, travellers: 2, status: "UPCOMING",  totalAmount: 120000, paidAmount: 60000  } });
console.log("✅ Vikrant bookings: 6");

// ── Payments ─────────────────────────────────────────────────────────
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb1.id, amount: 85000,  gateway: "RAZORPAY", method: "CARD",        status: "SUCCESS",  gatewayOrderId: "vorder_001", gatewayPaymentId: "vpay_001", paidAt: new Date("2024-03-01") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb2.id, amount: 55000,  gateway: "RAZORPAY", method: "UPI",         status: "SUCCESS",  gatewayOrderId: "vorder_002", gatewayPaymentId: "vpay_002", paidAt: new Date("2024-09-01") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb3.id, amount: 42000,  gateway: "RAZORPAY", method: "NET_BANKING", status: "SUCCESS",  gatewayOrderId: "vorder_003", gatewayPaymentId: "vpay_003", paidAt: new Date("2025-01-01") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb4.id, amount: 32500,  gateway: "RAZORPAY", method: "UPI",         status: "REFUNDED", gatewayOrderId: "vorder_004", gatewayPaymentId: "vpay_004", paidAt: new Date("2025-04-15"), refundAmount: 32500, refundedAt: new Date("2025-05-05") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb5.id, amount: 47500,  gateway: "RAZORPAY", method: "EMI",         status: "SUCCESS",  gatewayOrderId: "vorder_005", gatewayPaymentId: "vpay_005", paidAt: new Date("2026-03-15") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb6.id, amount: 60000,  gateway: "RAZORPAY", method: "CARD",        status: "SUCCESS",  gatewayOrderId: "vorder_006", gatewayPaymentId: "vpay_006", paidAt: new Date("2026-04-10") } });
await db.payment.create({ data: { userId: vikrant.id, bookingId: vb6.id, amount: 60000,  gateway: "RAZORPAY", method: "UPI",         status: "FAILED",   gatewayOrderId: "vorder_007", failureReason: "Bank server timeout" } });
console.log("✅ Vikrant payments: 7");

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  console.log("\n📊 Seed Summary:");
  const summary = await Promise.all([
    db.regions.count(), db.destinations.count(), db.categories.count(), db.tags.count(),
    db.packages.count(), db.package_durations.count(), db.package_stay_categories.count(),
    db.package_pricing.count(), db.package_itineraries.count(),
    db.hotels.count(), db.hotel_room_pricing.count(), db.hotel_images.count(),
    db.activities.count(), db.activity_images.count(),
    db.package_hotels.count(), db.package_activities.count(),
    db.package_images.count(), db.pricing_rules.count(),
    db.user.count(), db.booking.count(), db.payment.count(),
  ]);
  const labels = [
    "regions", "destinations", "categories", "tags",
    "packages", "package_durations", "package_stay_categories", "package_pricing", "package_itineraries",
    "hotels", "hotel_room_pricing", "hotel_images",
    "activities", "activity_images",
    "package_hotels", "package_activities", "package_images", "pricing_rules",
    "users", "bookings", "payments",
  ];
  labels.forEach((l, i) => console.log(`   ${l.padEnd(28)} → ${summary[i]}`));

  console.log("\n📍 Test URLs:");
  console.log("   /packages/kashmir-grand-tour/6-days/route-0/deluxe");
  console.log("   /packages/kashmir-grand-tour/4-days/route-0/standard");
  console.log("   /packages/shimla-manali-classic/7-days/route-1/deluxe");
  console.log("\n📋 Test user: test@dreamsyatri.com");
  console.log("\n🎉 Seed complete.");
}

seed()
  .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); });