// Demo hotels for the booking flow (dev). Re-runnable: skips hotels whose slug
// already exists. Run: node --env-file=.env --env-file=.env.development.local prisma/seeds/demo-hotels.mjs
import dns from "dns/promises";
import pg from "pg";
import { PrismaClient } from "../../app/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const { Pool } = pg;

const url = new URL(process.env.DATABASE_URL);
let ip; try { [ip] = await dns.resolve4(url.hostname); } catch { ({ address: ip } = await dns.lookup(url.hostname, { family: 4 })); }
const pool = new Pool({ host: ip, port: +url.port || 5432, database: url.pathname.slice(1), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), ssl: { rejectUnauthorized: false, servername: url.hostname }, max: 3 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const IMG = (id, w = 1200, h = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const HOTELS = [
  {
    slug: "the-ganges-grand",
    name: "The Ganges Grand",
    city: "Varanasi", state: "Uttar Pradesh", address: "Sigra, Near Cantonment",
    star_rating: 4,
    description: "A refined riverside retreat minutes from the ghats — contemporary rooms, a rooftop restaurant, and warm Banarasi hospitality.",
    check_in_time: "1:00 PM", check_out_time: "11:00 AM",
    cancellation_policy: "FREE_TILL_48H",
    allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: false, pets_allowed: false,
    acceptable_id_proofs: ["Aadhaar Card", "Passport", "Driving License"],
    amenities: { "Free Wi-Fi": true, "Free Parking": true, "Swimming Pool": true, "Restaurant": true, "Room Service": true, "Air Conditioning": true, "Spa": true, "Fitness Centre": true },
    images: ["photo-1566073771259-6a8506099945", "photo-1571003123894-1f0594d2b5d9", "photo-1618773928121-c32242e63f39", "photo-1582719478250-c89cae4dc85b", "photo-1445019980597-93fa8acb246c"],
    rooms: [
      { name: "Deluxe River View", area: 240, bed: "1 King Bed", view: "River View", price: 4200, original: 5200, gst: 12, plan: "Room with Breakfast", cancel: "FREE_TILL_48H", amenities: ["Air Conditioning", "Free Wi-Fi", "LED TV", "Mini Fridge", "Tea/Coffee Maker"], imgs: ["photo-1631049307264-da0ec9d70304", "photo-1618773928121-c32242e63f39"] },
      { name: "Premium Suite", area: 480, bed: "1 King + Sofa", view: "River View", price: 7800, original: 9500, gst: 18, plan: "Suite with Breakfast", cancel: "FREE_TILL_CHECKIN", amenities: ["Air Conditioning", "Free Wi-Fi", "Bathtub", "Living Area", "Mini Bar"], imgs: ["photo-1582719478250-c89cae4dc85b", "photo-1560448204-e02f11c3d0e2"] },
      { name: "Standard Room", area: 180, bed: "1 Queen Bed", view: "City View", price: 2600, original: 3200, gst: 12, plan: "Room Only", cancel: "NON_REFUNDABLE", amenities: ["Air Conditioning", "Free Wi-Fi", "LED TV"], imgs: ["photo-1611892440504-42a792e24d32"] },
    ],
  },
  {
    slug: "himalayan-retreat-manali",
    name: "Himalayan Retreat",
    city: "Manali", state: "Himachal Pradesh", address: "Log Huts Area, Old Manali",
    star_rating: 4,
    description: "Cosy pine-wood cottages wrapped in Himalayan views, with bonfires, mountain breakfasts and easy access to Old Manali cafes.",
    check_in_time: "2:00 PM", check_out_time: "10:00 AM",
    cancellation_policy: "FREE_TILL_72H",
    allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: true, pets_allowed: true,
    acceptable_id_proofs: ["Aadhaar Card", "Passport", "Voter ID"],
    amenities: { "Free Wi-Fi": true, "Free Parking": true, "Restaurant": true, "Bonfire": true, "Room Heater": true, "Mountain View": true, "Pet Friendly": true },
    images: ["photo-1506905925346-21bda4d32df4", "photo-1521401830884-6c03c1c87ebb", "photo-1517320964276-a002fa203177", "photo-1610641818989-c2051b5e2cfd"],
    rooms: [
      { name: "Wooden Cottage", area: 300, bed: "1 King Bed", view: "Mountain View", price: 5500, original: 6800, gst: 12, plan: "Cottage with Breakfast", cancel: "FREE_TILL_72H", amenities: ["Room Heater", "Free Wi-Fi", "Balcony", "Mountain View"], imgs: ["photo-1521401830884-6c03c1c87ebb", "photo-1517320964276-a002fa203177"] },
      { name: "Family Suite", area: 520, bed: "2 Queen Beds", view: "Valley View", price: 8900, original: 10500, gst: 18, plan: "Suite with All Meals", cancel: "FREE_TILL_CHECKIN", amenities: ["Room Heater", "Free Wi-Fi", "Living Area", "Kitchenette", "Valley View"], imgs: ["photo-1610641818989-c2051b5e2cfd"] },
    ],
  },
  {
    slug: "goa-beachside-resort",
    name: "Goa Beachside Resort",
    city: "Goa", state: "Goa", address: "Candolim Beach Road, North Goa",
    star_rating: 5,
    description: "A breezy beachfront resort steps from Candolim sands — pool bar, sea-view suites, water sports and sunset dining.",
    check_in_time: "3:00 PM", check_out_time: "12:00 PM",
    cancellation_policy: "FREE_TILL_24H",
    allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: false, pets_allowed: false,
    acceptable_id_proofs: ["Aadhaar Card", "Passport", "Driving License", "Voter ID"],
    amenities: { "Free Wi-Fi": true, "Free Parking": true, "Swimming Pool": true, "Beach Access": true, "Bar": true, "Restaurant": true, "Spa": true, "Water Sports": true, "Air Conditioning": true },
    images: ["photo-1520250497591-112f2f40a3f4", "photo-1439130490301-25e322d88054", "photo-1571896349842-33c89424de2d", "photo-1615460549969-36fa19521a4f", "photo-1584132967334-10e028bd69f7"],
    rooms: [
      { name: "Sea View Room", area: 320, bed: "1 King Bed", view: "Sea View", price: 9500, original: 12000, gst: 18, plan: "Room with Breakfast", cancel: "FREE_TILL_24H", amenities: ["Air Conditioning", "Free Wi-Fi", "Balcony", "Sea View", "Mini Bar"], imgs: ["photo-1571896349842-33c89424de2d", "photo-1615460549969-36fa19521a4f"] },
      { name: "Beachfront Villa", area: 900, bed: "2 King Beds", view: "Beachfront", price: 18500, original: 22000, gst: 18, plan: "Villa with All Meals", cancel: "FREE_TILL_CHECKIN", amenities: ["Air Conditioning", "Private Pool", "Free Wi-Fi", "Living Area", "Beachfront", "Butler Service"], imgs: ["photo-1584132967334-10e028bd69f7"] },
      { name: "Garden Room", area: 260, bed: "1 Queen Bed", view: "Garden View", price: 6200, original: 7800, gst: 12, plan: "Room Only", cancel: "NON_REFUNDABLE", amenities: ["Air Conditioning", "Free Wi-Fi", "LED TV", "Garden View"], imgs: ["photo-1611892440504-42a792e24d32"] },
    ],
  },
];

const roomSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

for (const h of HOTELS) {
  // Idempotent: remove any prior seed of this slug (children first).
  const existing = await db.hotels.findFirst({ where: { slug: h.slug }, select: { id: true } });
  if (existing) {
    const rooms = await db.hotel_rooms.findMany({ where: { hotel_id: existing.id }, select: { id: true } });
    const roomIds = rooms.map((r) => r.id);
    if (roomIds.length) {
      await db.hotel_room_images.deleteMany({ where: { room_id: { in: roomIds } } });
      await db.hotel_room_pricing.deleteMany({ where: { room_id: { in: roomIds } } });
      await db.hotel_room_availability.deleteMany({ where: { room_id: { in: roomIds } } });
      await db.hotel_rooms.deleteMany({ where: { hotel_id: existing.id } });
    }
    await db.hotel_images.deleteMany({ where: { hotel_id: existing.id } });
    await db.hotel_image_categories.deleteMany({ where: { hotel_id: existing.id } });
    await db.hotels.delete({ where: { id: existing.id } });
    console.log(`removed prior: ${h.slug}`);
  }

  const hotel = await db.hotels.create({
    data: {
      name: h.name, slug: h.slug, city: h.city, state: h.state, country: "India",
      address: h.address, star_rating: h.star_rating, description: h.description,
      check_in_time: h.check_in_time, check_out_time: h.check_out_time,
      cancellation_policy: h.cancellation_policy, property_category: "HOTEL",
      allow_unmarried_couples: h.allow_unmarried_couples, allow_guests_below_18: h.allow_guests_below_18,
      smoking_allowed: h.smoking_allowed, pets_allowed: h.pets_allowed,
      acceptable_id_proofs: h.acceptable_id_proofs, property_amenities: h.amenities,
      listing_status: "LIVE", wizard_step: 8,
    },
    select: { id: true },
  });

  const cat = await db.hotel_image_categories.create({
    data: { hotel_id: hotel.id, name: "Property", is_system: true, sort_order: 0 },
    select: { id: true },
  });
  await db.hotel_images.createMany({
    data: h.images.map((id, i) => ({ hotel_id: hotel.id, category_id: cat.id, url: IMG(id), is_primary: i === 0, sort_order: i })),
  });

  let ri = 0;
  for (const r of h.rooms) {
    const room = await db.hotel_rooms.create({
      data: {
        hotel_id: hotel.id, name: r.name, slug: roomSlug(r.name), area_sqft: r.area, area_unit: "sqft",
        bed_type: r.bed, view_type: r.view, num_rooms: 5, base_adults: 2, max_adults: 2, max_children: 1,
        max_occupancy: 3, amenities: r.amenities, is_active: true, sort_order: ri++,
      },
      select: { id: true },
    });
    await db.hotel_room_pricing.create({
      data: {
        hotel_id: hotel.id, room_id: room.id, plan_name: r.plan, price_per_night: r.price,
        original_price: r.original, gst_percentage: r.gst, cancellation_policy: r.cancel,
        is_active: true, sort_order: 0,
      },
    });
    await db.hotel_room_images.createMany({
      data: r.imgs.map((id, i) => ({ room_id: room.id, url: IMG(id, 800, 600), is_primary: i === 0, sort_order: i })),
    });
  }
  console.log(`created: ${h.slug}  (hotel ${hotel.id}, ${h.rooms.length} rooms)`);
}

await db.$disconnect(); await pool.end();
console.log("\nDone. Test links:\n" + HOTELS.map((h) => `  http://localhost:3000/hotels/${h.slug}`).join("\n"));
