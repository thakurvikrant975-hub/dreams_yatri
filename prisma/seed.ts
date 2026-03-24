import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const db   = new PrismaClient({ adapter: new PrismaPg(pool as never) });

async function seed() {
  console.log("🌱 Seeding...");

  // ── Clear ─────────────────────────────────────────────────────────────────
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
  await db.activity_images.deleteMany();
  await db.activities.deleteMany();
  await db.hotel_rooms.deleteMany();
  await db.hotel_images.deleteMany();
  await db.hotels.deleteMany();
  await db.tags.deleteMany();
  await db.categories.deleteMany();
  await db.destinations.deleteMany();
  await db.regions.deleteMany();
  console.log("🧹 Cleared");

  // ── Regions ───────────────────────────────────────────────────────────────
  const northIndia  = await db.regions.create({ data: { name: "North India",     slug: "north-india",     country: "India", description: "The majestic Himalayas, valleys and heritage cities.", meta_title: "North India Tours",     meta_desc: "Explore North India with Dreams Yatri."     } });
  const southIndia  = await db.regions.create({ data: { name: "South India",     slug: "south-india",     country: "India", description: "Temples, backwaters and pristine beaches.",          meta_title: "South India Tours",     meta_desc: "Explore South India with Dreams Yatri."     } });
  const northeast   = await db.regions.create({ data: { name: "Northeast India", slug: "northeast-india", country: "India", description: "Seven sisters — forests, root bridges and culture.", meta_title: "Northeast India Tours", meta_desc: "Explore Northeast India with Dreams Yatri." } });
  const westIndia   = await db.regions.create({ data: { name: "West India",      slug: "west-india",      country: "India", description: "Beaches, deserts and royal heritage.",               meta_title: "West India Tours",      meta_desc: "Explore West India with Dreams Yatri."      } });
  const centralIndia= await db.regions.create({ data: { name: "Central India",   slug: "central-india",   country: "India", description: "Wildlife, temples and tribal heartland.",            meta_title: "Central India Tours",   meta_desc: "Explore Central India with Dreams Yatri."  } });
  const eastIndia   = await db.regions.create({ data: { name: "East India",      slug: "east-india",      country: "India", description: "Cultural richness and natural beauty.",              meta_title: "East India Tours",      meta_desc: "Explore East India with Dreams Yatri."     } });
  const islands     = await db.regions.create({ data: { name: "Islands",         slug: "islands",         country: "India", description: "Pristine island destinations of India.",            meta_title: "Island Tours India",    meta_desc: "Explore Indian islands with Dreams Yatri." } });
  console.log("✅ Regions: 7");

  // ── Destinations ──────────────────────────────────────────────────────────
  const kashmir    = await db.destinations.create({ data: { name: "Kashmir",          slug: "kashmir",           region_id: northIndia.id,  country: "India", description: "Paradise on earth.",          meta_title: "Kashmir Tour Packages | Dreams Yatri",          meta_desc: "Book Kashmir packages at best prices."          } });
  const himachal   = await db.destinations.create({ data: { name: "Himachal Pradesh", slug: "himachal-pradesh",  region_id: northIndia.id,  country: "India", description: "Snow peaks and apple orchards.", meta_title: "Himachal Pradesh Tour Packages | Dreams Yatri", meta_desc: "Shimla, Manali and Spiti with Dreams Yatri."     } });
  const uttarakhand= await db.destinations.create({ data: { name: "Uttarakhand",      slug: "uttarakhand",       region_id: northIndia.id,  country: "India", description: "Land of gods.",               meta_title: "Uttarakhand Tour Packages | Dreams Yatri",      meta_desc: "Char Dham and Nainital with Dreams Yatri."       } });
  const goa        = await db.destinations.create({ data: { name: "Goa",              slug: "goa",               region_id: westIndia.id,   country: "India", description: "Sun, sand and seafood.",      meta_title: "Goa Tour Packages | Dreams Yatri",              meta_desc: "Best Goa packages with beach stays."             } });
  const rajasthan  = await db.destinations.create({ data: { name: "Rajasthan",        slug: "rajasthan",         region_id: westIndia.id,   country: "India", description: "Royal forts and deserts.",    meta_title: "Rajasthan Tour Packages | Dreams Yatri",        meta_desc: "Explore royal Rajasthan with Dreams Yatri."      } });
  const kerala     = await db.destinations.create({ data: { name: "Kerala",           slug: "kerala",            region_id: southIndia.id,  country: "India", description: "God's own country.",         meta_title: "Kerala Tour Packages | Dreams Yatri",           meta_desc: "Backwaters and ayurveda with Dreams Yatri."      } });
  const meghalaya  = await db.destinations.create({ data: { name: "Meghalaya",        slug: "meghalaya",         region_id: northeast.id,   country: "India", description: "Abode of clouds.",            meta_title: "Meghalaya Tour Packages | Dreams Yatri",        meta_desc: "Living root bridges with Dreams Yatri."          } });
  console.log("✅ Destinations: 7");

  // ── Categories ────────────────────────────────────────────────────────────
  const catHill       = await db.categories.create({ data: { name: "Hill Station", slug: "hill-station", description: "Mountain destinations",        sort_order: 1 } });
  const catBeach      = await db.categories.create({ data: { name: "Beach",        slug: "beach",        description: "Coastal destinations",         sort_order: 2 } });
  const catPilgrimage = await db.categories.create({ data: { name: "Pilgrimage",   slug: "pilgrimage",   description: "Religious and spiritual tours", sort_order: 3 } });
  const catAdventure  = await db.categories.create({ data: { name: "Adventure",    slug: "adventure",    description: "Trekking and outdoor sports",   sort_order: 4 } });
  const catWildlife   = await db.categories.create({ data: { name: "Wildlife",     slug: "wildlife",     description: "Jungle safaris",               sort_order: 5 } });
  const catCultural   = await db.categories.create({ data: { name: "Cultural",     slug: "cultural",     description: "Heritage tours",               sort_order: 6 } });
  const catHoneymoon  = await db.categories.create({ data: { name: "Honeymoon",    slug: "honeymoon",    description: "Romantic packages",            sort_order: 7 } });
  console.log("✅ Categories: 7");

  // ── Tags ──────────────────────────────────────────────────────────────────
  const tagSnow       = await db.tags.create({ data: { name: "Snow",       slug: "snow",       group: "activity" } });
  const tagAdventure  = await db.tags.create({ data: { name: "Adventure",  slug: "adventure",  group: "activity" } });
  const tagFamily     = await db.tags.create({ data: { name: "Family",     slug: "family",     group: "type"     } });
  const tagHoneymoon  = await db.tags.create({ data: { name: "Honeymoon",  slug: "honeymoon",  group: "type"     } });
  const tagBudget     = await db.tags.create({ data: { name: "Budget",     slug: "budget",     group: "budget"   } });
  const tagLuxury     = await db.tags.create({ data: { name: "Luxury",     slug: "luxury",     group: "budget"   } });
  const tagTrekking   = await db.tags.create({ data: { name: "Trekking",   slug: "trekking",   group: "activity" } });
  const tagBeach      = await db.tags.create({ data: { name: "Beach",      slug: "beach",      group: "activity" } });
  const tagWildlife   = await db.tags.create({ data: { name: "Wildlife",   slug: "wildlife",   group: "activity" } });
  const tagPilgrimage = await db.tags.create({ data: { name: "Pilgrimage", slug: "pilgrimage", group: "activity" } });
  const tagSummer     = await db.tags.create({ data: { name: "Summer",     slug: "summer",     group: "season"   } });
  const tagWinter     = await db.tags.create({ data: { name: "Winter",     slug: "winter",     group: "season"   } });
  console.log("✅ Tags: 12");

  // ── Hotels ────────────────────────────────────────────────────────────────
  const hotelNehru    = await db.hotels.create({ data: { name: "Hotel Nehru Palace",        slug: "hotel-nehru-palace",        destination_id: kashmir.id,   description: "Luxury hotel overlooking Dal Lake.",             star_rating: 5, category: "hotel",     address: "Boulevard Road, Srinagar",        check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","pool","spa","restaurant","parking"]               } });
  const hotelGrand    = await db.hotels.create({ data: { name: "Grand Houseboat Srinagar",  slug: "grand-houseboat-srinagar",  destination_id: kashmir.id,   description: "Traditional Kashmiri houseboat on Dal Lake.",    star_rating: 4, category: "houseboat", address: "Dal Lake, Srinagar",              check_in_time: "13:00", check_out_time: "10:00", amenities: ["wifi","restaurant","shikara-ride"]                       } });
  const hotelDal      = await db.hotels.create({ data: { name: "Dal View Resort",           slug: "dal-view-resort",           destination_id: kashmir.id,   description: "Budget resort with Dal Lake views.",            star_rating: 3, category: "resort",    address: "Nagin Lake Road, Srinagar",       check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","restaurant","parking"]                            } });
  const hotelManu     = await db.hotels.create({ data: { name: "Hotel Manuallaya Manali",   slug: "hotel-manuallaya-manali",   destination_id: himachal.id,  description: "Riverside resort in deodar forests.",           star_rating: 5, category: "resort",    address: "Old Manali Road, Manali",         check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","spa","restaurant","bonfire","mountain-view"]      } });
  const hotelSnow     = await db.hotels.create({ data: { name: "Snow Valley Resort Shimla", slug: "snow-valley-resort-shimla", destination_id: himachal.id,  description: "Heritage property on Shimla Ridge.",            star_rating: 4, category: "hotel",     address: "The Ridge, Shimla",               check_in_time: "13:00", check_out_time: "12:00", amenities: ["wifi","restaurant","valley-view"]                        } });
  const hotelPinewood = await db.hotels.create({ data: { name: "Pinewood Hotel Shimla",     slug: "pinewood-hotel-shimla",     destination_id: himachal.id,  description: "Colonial era hotel in Shimla.",                 star_rating: 3, category: "hotel",     address: "Lakkar Bazaar, Shimla",           check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","restaurant","parking"]                            } });
  const hotelSpice    = await db.hotels.create({ data: { name: "Spice Village Goa",         slug: "spice-village-goa",         destination_id: goa.id,       description: "Beachfront resort in North Goa.",               star_rating: 4, category: "resort",    address: "Calangute Beach Road, North Goa", check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","pool","beach-access","restaurant"]               } });
  const hotelLeela    = await db.hotels.create({ data: { name: "The Leela Goa",             slug: "the-leela-goa",             destination_id: goa.id,       description: "Luxury beachfront resort in South Goa.",        star_rating: 5, category: "resort",    address: "Mobor, Cavelossim, South Goa",    check_in_time: "14:00", check_out_time: "12:00", amenities: ["wifi","pool","spa","restaurant","beach-access","gym"]    } });
  const hotelRaj      = await db.hotels.create({ data: { name: "Umaid Bhawan Palace",       slug: "umaid-bhawan-palace",       destination_id: rajasthan.id, description: "Royal palace hotel in Jodhpur.",                star_rating: 5, category: "hotel",     address: "Circuit House Road, Jodhpur",     check_in_time: "14:00", check_out_time: "12:00", amenities: ["wifi","pool","spa","restaurant","heritage-walk"]         } });
  const hotelHeritage = await db.hotels.create({ data: { name: "Heritage Haveli Jaipur",    slug: "heritage-haveli-jaipur",    destination_id: rajasthan.id, description: "Traditional haveli in the heart of Jaipur.",    star_rating: 4, category: "hotel",     address: "Old City, Jaipur, Rajasthan",     check_in_time: "13:00", check_out_time: "11:00", amenities: ["wifi","restaurant","rooftop-view","heritage-tour"]       } });
  const hotelKerala   = await db.hotels.create({ data: { name: "Kumarakom Lake Resort",     slug: "kumarakom-lake-resort",     destination_id: kerala.id,    description: "Luxury backwater resort in Kumarakom.",         star_rating: 5, category: "resort",    address: "Kumarakom, Kottayam, Kerala",     check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","pool","spa","restaurant","houseboat","ayurveda"]  } });
  const hotelSpiceK   = await db.hotels.create({ data: { name: "Spice Village Thekkady",    slug: "spice-village-thekkady",    destination_id: kerala.id,    description: "Eco resort inside Periyar Wildlife Sanctuary.",  star_rating: 4, category: "resort",    address: "Thekkady, Idukki, Kerala",        check_in_time: "14:00", check_out_time: "11:00", amenities: ["wifi","restaurant","jungle-safari","ayurveda"]          } });
  console.log("✅ Hotels: 12");

  // ── Hotel Images ──────────────────────────────────────────────────────────
  await db.hotel_images.createMany({ data: [
    // Nehru Palace
    { hotel_id: hotelNehru.id,    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200", thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", alt: "Hotel Nehru Palace exterior",   sort_order: 1, is_primary: true  },
    { hotel_id: hotelNehru.id,    url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200", thumbnail: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", alt: "Hotel Nehru Palace room",       sort_order: 2, is_primary: false },
    { hotel_id: hotelNehru.id,    url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200", thumbnail: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400", alt: "Hotel Nehru Palace pool",       sort_order: 3, is_primary: false },
    { hotel_id: hotelNehru.id,    url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Hotel Nehru Palace restaurant", sort_order: 4, is_primary: false },
    { hotel_id: hotelNehru.id,    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Hotel Nehru Palace lake view",  sort_order: 5, is_primary: false },
    // Grand Houseboat
    { hotel_id: hotelGrand.id,    url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Grand Houseboat Dal Lake",      sort_order: 1, is_primary: true  },
    { hotel_id: hotelGrand.id,    url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Grand Houseboat interior",      sort_order: 2, is_primary: false },
    { hotel_id: hotelGrand.id,    url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200", thumbnail: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400", alt: "Grand Houseboat bedroom",       sort_order: 3, is_primary: false },
    { hotel_id: hotelGrand.id,    url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200", thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400", alt: "Grand Houseboat dal view",      sort_order: 4, is_primary: false },
    // Dal View Resort
    { hotel_id: hotelDal.id,      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200", thumbnail: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400", alt: "Dal View Resort exterior",      sort_order: 1, is_primary: true  },
    { hotel_id: hotelDal.id,      url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200",    thumbnail: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",    alt: "Dal View Resort room",          sort_order: 2, is_primary: false },
    { hotel_id: hotelDal.id,      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200", thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", alt: "Dal View Resort garden",        sort_order: 3, is_primary: false },
    // Manuallaya Manali
    { hotel_id: hotelManu.id,     url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Manuallaya Resort exterior",    sort_order: 1, is_primary: true  },
    { hotel_id: hotelManu.id,     url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200", thumbnail: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400", alt: "Manuallaya Resort room",        sort_order: 2, is_primary: false },
    { hotel_id: hotelManu.id,     url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Manuallaya Resort restaurant",  sort_order: 3, is_primary: false },
    { hotel_id: hotelManu.id,     url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Manuallaya Resort mountain",    sort_order: 4, is_primary: false },
    { hotel_id: hotelManu.id,     url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Manuallaya Resort forest",      sort_order: 5, is_primary: false },
    // Snow Valley Shimla
    { hotel_id: hotelSnow.id,     url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200",    thumbnail: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",    alt: "Snow Valley Resort exterior",   sort_order: 1, is_primary: true  },
    { hotel_id: hotelSnow.id,     url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200", thumbnail: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400", alt: "Snow Valley Resort room",       sort_order: 2, is_primary: false },
    { hotel_id: hotelSnow.id,     url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200", thumbnail: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400", alt: "Snow Valley Resort lobby",      sort_order: 3, is_primary: false },
    { hotel_id: hotelSnow.id,     url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Snow Valley valley view",       sort_order: 4, is_primary: false },
    // Pinewood Shimla
    { hotel_id: hotelPinewood.id, url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200", thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", alt: "Pinewood Hotel exterior",       sort_order: 1, is_primary: true  },
    { hotel_id: hotelPinewood.id, url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200", thumbnail: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", alt: "Pinewood Hotel room",           sort_order: 2, is_primary: false },
    { hotel_id: hotelPinewood.id, url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Pinewood Hotel dining",         sort_order: 3, is_primary: false },
    // Spice Village Goa
    { hotel_id: hotelSpice.id,    url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Spice Village Goa beach",       sort_order: 1, is_primary: true  },
    { hotel_id: hotelSpice.id,    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Spice Village Goa pool",        sort_order: 2, is_primary: false },
    { hotel_id: hotelSpice.id,    url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Spice Village Goa room",        sort_order: 3, is_primary: false },
    { hotel_id: hotelSpice.id,    url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200",    thumbnail: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",    alt: "Spice Village Goa restaurant",  sort_order: 4, is_primary: false },
    // The Leela Goa
    { hotel_id: hotelLeela.id,    url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "The Leela Goa exterior",        sort_order: 1, is_primary: true  },
    { hotel_id: hotelLeela.id,    url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "The Leela Goa beach",           sort_order: 2, is_primary: false },
    { hotel_id: hotelLeela.id,    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "The Leela Goa pool",            sort_order: 3, is_primary: false },
    { hotel_id: hotelLeela.id,    url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200", thumbnail: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400", alt: "The Leela Goa room",            sort_order: 4, is_primary: false },
    { hotel_id: hotelLeela.id,    url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200", thumbnail: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", alt: "The Leela Goa spa",             sort_order: 5, is_primary: false },
    // Umaid Bhawan
    { hotel_id: hotelRaj.id,      url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Umaid Bhawan Palace exterior",  sort_order: 1, is_primary: true  },
    { hotel_id: hotelRaj.id,      url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200", thumbnail: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400", alt: "Umaid Bhawan Palace room",      sort_order: 2, is_primary: false },
    { hotel_id: hotelRaj.id,      url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Umaid Bhawan Palace pool",      sort_order: 3, is_primary: false },
    { hotel_id: hotelRaj.id,      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200", thumbnail: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400", alt: "Umaid Bhawan Palace dining",    sort_order: 4, is_primary: false },
    // Heritage Haveli Jaipur
    { hotel_id: hotelHeritage.id, url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200", thumbnail: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", alt: "Heritage Haveli exterior",      sort_order: 1, is_primary: true  },
    { hotel_id: hotelHeritage.id, url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Heritage Haveli courtyard",     sort_order: 2, is_primary: false },
    { hotel_id: hotelHeritage.id, url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200", thumbnail: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400", alt: "Heritage Haveli room",          sort_order: 3, is_primary: false },
    // Kumarakom Lake Resort
    { hotel_id: hotelKerala.id,   url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Kumarakom Lake Resort exterior", sort_order: 1, is_primary: true  },
    { hotel_id: hotelKerala.id,   url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Kumarakom Lake Resort pool",    sort_order: 2, is_primary: false },
    { hotel_id: hotelKerala.id,   url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Kumarakom houseboat",           sort_order: 3, is_primary: false },
    { hotel_id: hotelKerala.id,   url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Kumarakom backwater view",      sort_order: 4, is_primary: false },
    // Spice Village Thekkady
    { hotel_id: hotelSpiceK.id,   url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Spice Village Thekkady exterior",sort_order: 1, is_primary: true  },
    { hotel_id: hotelSpiceK.id,   url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Spice Village Thekkady jungle",  sort_order: 2, is_primary: false },
    { hotel_id: hotelSpiceK.id,   url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200",    thumbnail: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",    alt: "Spice Village Thekkady room",    sort_order: 3, is_primary: false },
  ]});

  // ── Hotel Rooms ───────────────────────────────────────────────────────────
  await db.hotel_rooms.createMany({ data: [
    { hotel_id: hotelNehru.id,    name: "Deluxe Room",      capacity: 2, amenities: ["AC","TV","minibar","lake-view"],             is_active: true },
    { hotel_id: hotelNehru.id,    name: "Suite",            capacity: 2, amenities: ["AC","TV","jacuzzi","lake-view","balcony"],   is_active: true },
    { hotel_id: hotelGrand.id,    name: "Standard Cabin",   capacity: 2, amenities: ["AC","TV","lake-view"],                      is_active: true },
    { hotel_id: hotelGrand.id,    name: "Deluxe Cabin",     capacity: 2, amenities: ["AC","TV","lake-view","balcony"],            is_active: true },
    { hotel_id: hotelDal.id,      name: "Standard Room",    capacity: 2, amenities: ["AC","TV"],                                  is_active: true },
    { hotel_id: hotelManu.id,     name: "Forest View Room", capacity: 2, amenities: ["heater","TV","forest-view","balcony"],      is_active: true },
    { hotel_id: hotelManu.id,     name: "River View Suite", capacity: 2, amenities: ["heater","TV","river-view","jacuzzi"],       is_active: true },
    { hotel_id: hotelSnow.id,     name: "Standard Room",    capacity: 2, amenities: ["heater","TV","valley-view"],                is_active: true },
    { hotel_id: hotelSnow.id,     name: "Deluxe Room",      capacity: 2, amenities: ["heater","TV","valley-view","balcony"],      is_active: true },
    { hotel_id: hotelPinewood.id, name: "Classic Room",     capacity: 2, amenities: ["heater","TV"],                              is_active: true },
    { hotel_id: hotelSpice.id,    name: "Beach Cottage",    capacity: 2, amenities: ["AC","TV","beach-view","balcony"],           is_active: true },
    { hotel_id: hotelLeela.id,    name: "Deluxe Room",      capacity: 2, amenities: ["AC","TV","sea-view","balcony"],             is_active: true },
    { hotel_id: hotelLeela.id,    name: "Pool Villa",       capacity: 2, amenities: ["AC","TV","private-pool","garden"],          is_active: true },
    { hotel_id: hotelRaj.id,      name: "Heritage Room",    capacity: 2, amenities: ["AC","TV","heritage-decor","courtyard-view"],is_active: true },
    { hotel_id: hotelRaj.id,      name: "Royal Suite",      capacity: 2, amenities: ["AC","TV","jacuzzi","palace-view"],          is_active: true },
    { hotel_id: hotelHeritage.id, name: "Haveli Room",      capacity: 2, amenities: ["AC","TV","courtyard-view"],                 is_active: true },
    { hotel_id: hotelKerala.id,   name: "Lake View Villa",  capacity: 2, amenities: ["AC","TV","lake-view","private-deck"],       is_active: true },
    { hotel_id: hotelKerala.id,   name: "Heritage Cottage", capacity: 2, amenities: ["AC","TV","garden","ayurveda"],              is_active: true },
    { hotel_id: hotelSpiceK.id,   name: "Jungle Cottage",   capacity: 2, amenities: ["AC","TV","jungle-view"],                    is_active: true },
  ]});
  console.log("✅ Hotel rooms: 19");

  // ── Activities ────────────────────────────────────────────────────────────
  const actShikara    = await db.activities.create({ data: { name: "Dal Lake Shikara Ride",      slug: "dal-lake-shikara-ride",      destination_id: kashmir.id,    duration_hours: 2.0, difficulty: "easy",     category: "sightseeing", price: 800,  description: "Traditional shikara boat ride on Dal Lake."       } });
  const actGondola    = await db.activities.create({ data: { name: "Gulmarg Gondola Ride",       slug: "gulmarg-gondola-ride",       destination_id: kashmir.id,    duration_hours: 3.0, difficulty: "easy",     category: "adventure",   price: 1500, description: "Asia's highest cable car with Himalayan views."   } });
  const actSkiing     = await db.activities.create({ data: { name: "Skiing at Gulmarg",          slug: "skiing-at-gulmarg",          destination_id: kashmir.id,    duration_hours: 5.0, difficulty: "moderate", category: "adventure",   price: 3000, description: "World-class skiing on Gulmarg slopes."            } });
  const actRafting    = await db.activities.create({ data: { name: "Beas River Rafting",         slug: "beas-river-rafting",         destination_id: himachal.id,   duration_hours: 3.0, difficulty: "moderate", category: "adventure",   price: 1200, description: "White water rafting on Beas River near Manali."   } });
  const actRohtang    = await db.activities.create({ data: { name: "Rohtang Pass Day Trip",      slug: "rohtang-pass-day-trip",      destination_id: himachal.id,   duration_hours: 8.0, difficulty: "easy",     category: "sightseeing", price: 2500, description: "Day excursion to Rohtang Pass at 3978m."          } });
  const actRootBridge = await db.activities.create({ data: { name: "Living Root Bridge Trek",   slug: "living-root-bridge-trek",   destination_id: meghalaya.id,  duration_hours: 6.0, difficulty: "hard",     category: "trekking",    price: 1800, description: "Trek to double-decker living root bridge."        } });
  const actDudhsagar  = await db.activities.create({ data: { name: "Dudhsagar Waterfall Visit", slug: "dudhsagar-waterfall-visit", destination_id: goa.id,        duration_hours: 8.0, difficulty: "moderate", category: "sightseeing", price: 2000, description: "Full day excursion to majestic Dudhsagar Falls."  } });
  const actCamel      = await db.activities.create({ data: { name: "Camel Safari Jaisalmer",    slug: "camel-safari-jaisalmer",    destination_id: rajasthan.id,  duration_hours: 4.0, difficulty: "easy",     category: "adventure",   price: 1500, description: "Sunset camel safari in the Thar Desert."          } });
  const actElephant   = await db.activities.create({ data: { name: "Elephant Village Jaipur",   slug: "elephant-village-jaipur",   destination_id: rajasthan.id,  duration_hours: 3.0, difficulty: "easy",     category: "cultural",    price: 2000, description: "Interact with elephants at Elephant Village."     } });
  const actHouseboat  = await db.activities.create({ data: { name: "Kerala Houseboat Stay",     slug: "kerala-houseboat-stay",     destination_id: kerala.id,     duration_hours: 24.0,difficulty: "easy",     category: "sightseeing", price: 8000, description: "Overnight houseboat cruise on Kerala backwaters."  } });
  const actAyurveda   = await db.activities.create({ data: { name: "Ayurvedic Spa Treatment",   slug: "ayurvedic-spa-treatment",   destination_id: kerala.id,     duration_hours: 3.0, difficulty: "easy",     category: "wellness",    price: 3500, description: "Traditional Kerala ayurveda treatment."           } });
  const actBeachGoa   = await db.activities.create({ data: { name: "Water Sports Goa",          slug: "water-sports-goa",          destination_id: goa.id,        duration_hours: 3.0, difficulty: "moderate", category: "adventure",   price: 2500, description: "Parasailing, jet ski and banana boat rides."      } });
  console.log("✅ Activities: 12");

  // ── Activity Images ───────────────────────────────────────────────────────
  await db.activity_images.createMany({ data: [
    { activity_id: actShikara.id,    url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200",    thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",    alt: "Dal Lake Shikara",           sort_order: 1, is_primary: true  },
    { activity_id: actShikara.id,    url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200", thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400", alt: "Dal Lake sunrise",           sort_order: 2, is_primary: false },
    { activity_id: actShikara.id,    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Dal Lake houseboats",        sort_order: 3, is_primary: false },
    { activity_id: actShikara.id,    url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Dal Lake floating market",   sort_order: 4, is_primary: false },
    { activity_id: actGondola.id,    url: "https://images.unsplash.com/photo-1624967890547-fb24c62ddb36?w=1200", thumbnail: "https://images.unsplash.com/photo-1624967890547-fb24c62ddb36?w=400", alt: "Gulmarg Gondola",            sort_order: 1, is_primary: true  },
    { activity_id: actGondola.id,    url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Gulmarg snow mountains",     sort_order: 2, is_primary: false },
    { activity_id: actGondola.id,    url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Gulmarg valley view",        sort_order: 3, is_primary: false },
    { activity_id: actSkiing.id,     url: "https://images.unsplash.com/photo-1551524164-6cf2ac2f4d7b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1551524164-6cf2ac2f4d7b?w=400",    alt: "Skiing Gulmarg",             sort_order: 1, is_primary: true  },
    { activity_id: actSkiing.id,     url: "https://images.unsplash.com/photo-1624967890547-fb24c62ddb36?w=1200", thumbnail: "https://images.unsplash.com/photo-1624967890547-fb24c62ddb36?w=400", alt: "Skiing snow trail",          sort_order: 2, is_primary: false },
    { activity_id: actSkiing.id,     url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Skiing mountain backdrop",   sort_order: 3, is_primary: false },
    { activity_id: actRafting.id,    url: "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=1200", thumbnail: "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=400", alt: "Beas River Rafting",         sort_order: 1, is_primary: true  },
    { activity_id: actRafting.id,    url: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=1200",    thumbnail: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=400",    alt: "Beas River rapids",          sort_order: 2, is_primary: false },
    { activity_id: actRafting.id,    url: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=1200", thumbnail: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=400", alt: "Beas River scenic",          sort_order: 3, is_primary: false },
    { activity_id: actRohtang.id,    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Rohtang Pass mountain",      sort_order: 1, is_primary: true  },
    { activity_id: actRohtang.id,    url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Rohtang Pass snow",          sort_order: 2, is_primary: false },
    { activity_id: actRohtang.id,    url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Rohtang Pass valley",        sort_order: 3, is_primary: false },
    { activity_id: actRootBridge.id, url: "https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?w=1200", thumbnail: "https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?w=400", alt: "Living Root Bridge",         sort_order: 1, is_primary: true  },
    { activity_id: actRootBridge.id, url: "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=1200", thumbnail: "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=400", alt: "Root Bridge trek path",      sort_order: 2, is_primary: false },
    { activity_id: actDudhsagar.id,  url: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=1200", thumbnail: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=400", alt: "Dudhsagar Waterfall",        sort_order: 1, is_primary: true  },
    { activity_id: actDudhsagar.id,  url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Dudhsagar Goa forest",       sort_order: 2, is_primary: false },
    { activity_id: actCamel.id,      url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Camel Safari Jaisalmer",     sort_order: 1, is_primary: true  },
    { activity_id: actCamel.id,      url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Thar Desert sunset",         sort_order: 2, is_primary: false },
    { activity_id: actElephant.id,   url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Elephant Village Jaipur",    sort_order: 1, is_primary: true  },
    { activity_id: actHouseboat.id,  url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Kerala Houseboat",           sort_order: 1, is_primary: true  },
    { activity_id: actHouseboat.id,  url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Kerala backwaters",          sort_order: 2, is_primary: false },
    { activity_id: actAyurveda.id,   url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Ayurvedic Spa Kerala",       sort_order: 1, is_primary: true  },
    { activity_id: actBeachGoa.id,   url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Water Sports Goa",           sort_order: 1, is_primary: true  },
    { activity_id: actBeachGoa.id,   url: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=1200", thumbnail: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=400", alt: "Goa beach parasailing",      sort_order: 2, is_primary: false },
  ]});
  console.log("✅ Activity images");

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 1 — Kashmir Grand Tour
  // ══════════════════════════════════════════════════════════════════════════
  const pkg1 = await db.packages.create({ data: { title: "Kashmir Grand Tour", slug: "kashmir-grand-tour", destination_id: kashmir.id, description: "Experience paradise on earth — houseboat stays on Dal Lake, snow adventures in Gulmarg and the valleys of Pahalgam.", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", cover_image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920", is_active: true } });

  const [p1s1, p1s2, p1s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg1.id, label: "Standard",     description: "3-star hotels and houseboats",  sort_order: 1, is_default: false, is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg1.id, label: "Deluxe",       description: "4-star hotels with lake views",  sort_order: 2, is_default: true,  is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg1.id, label: "Super Deluxe", description: "5-star luxury stays", min_duration_days: 5, sort_order: 3, is_default: false, is_active: true } }),
  ]);

  const [p1d4, p1d6, p1d7] = await Promise.all([
    db.package_durations.create({ data: { package_id: pkg1.id, slug: "4-days", label: "4 Days / 3 Nights", days: 4, nights: 3, is_default: false, sort_order: 1, meta_title: "Kashmir 4 Days Package | Dreams Yatri", meta_desc: "Short Kashmir trip covering Srinagar and Pahalgam.", routes: [{ id: 0, label: "Srinagar → Pahalgam → Srinagar", stops: ["Srinagar", "Pahalgam", "Srinagar"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg1.id, slug: "6-days", label: "6 Days / 5 Nights", days: 6, nights: 5, is_default: true,  sort_order: 2, meta_title: "Kashmir 6 Days Package | Dreams Yatri", meta_desc: "Most popular Kashmir tour — Srinagar, Gulmarg and Pahalgam.", routes: [{ id: 0, label: "Srinagar → Gulmarg → Pahalgam → Srinagar", stops: ["Srinagar","Gulmarg","Pahalgam","Srinagar"], is_default: true }, { id: 1, label: "Srinagar → Gulmarg → Pahalgam → Sonmarg → Srinagar", stops: ["Srinagar","Gulmarg","Pahalgam","Sonmarg","Srinagar"], is_default: false }] } }),
    db.package_durations.create({ data: { package_id: pkg1.id, slug: "7-days", label: "7 Days / 6 Nights", days: 7, nights: 6, is_default: false, sort_order: 3, meta_title: "Kashmir 7 Days Package | Dreams Yatri", meta_desc: "Complete Kashmir with Sonmarg extensions.", routes: [{ id: 0, label: "Srinagar → Gulmarg → Pahalgam → Sonmarg → Srinagar", stops: ["Srinagar","Gulmarg","Pahalgam","Sonmarg","Srinagar"], is_default: true }] } }),
  ]);

  await db.package_pricing.createMany({ data: [
    { package_id: pkg1.id, duration_id: p1d4.id, route_index: 0, stay_category_id: p1s1.id, price: 14999, original_price: 17999 },
    { package_id: pkg1.id, duration_id: p1d4.id, route_index: 0, stay_category_id: p1s2.id, price: 19999, original_price: 23999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s1.id, price: 24999, original_price: 29999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s2.id, price: 32999, original_price: 38999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 0, stay_category_id: p1s3.id, price: 44999, original_price: 52999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s1.id, price: 27999, original_price: 32999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s2.id, price: 35999, original_price: 42999 },
    { package_id: pkg1.id, duration_id: p1d6.id, route_index: 1, stay_category_id: p1s3.id, price: 47999, original_price: 55999 },
    { package_id: pkg1.id, duration_id: p1d7.id, route_index: 0, stay_category_id: p1s1.id, price: 29999, original_price: 35999 },
    { package_id: pkg1.id, duration_id: p1d7.id, route_index: 0, stay_category_id: p1s2.id, price: 39999, original_price: 46999 },
    { package_id: pkg1.id, duration_id: p1d7.id, route_index: 0, stay_category_id: p1s3.id, price: 52999, original_price: 62999 },
  ]});

  await db.package_itineraries.createMany({ data: [
    { package_id: pkg1.id, duration_id: p1d6.id, day: 1, title: "Arrival in Srinagar",   description: "Arrive and check in to your houseboat.",          hotel_id: hotelGrand.id, activity_ids: [actShikara.id],              activities: ["Airport pickup","Dal Lake shikara ride","Houseboat check-in"], meals: ["Dinner"]              },
    { package_id: pkg1.id, duration_id: p1d6.id, day: 2, title: "Gulmarg Day Trip",       description: "Full day excursion to Gulmarg.",                  hotel_id: hotelGrand.id, activity_ids: [actGondola.id, actSkiing.id], activities: ["Gondola cable car","Snow activities","Skiing option"],        meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d6.id, day: 3, title: "Pahalgam Excursion",     description: "Drive to the valley of shepherds.",               hotel_id: hotelDal.id,   activity_ids: [],                           activities: ["Betaab Valley","Aru Valley","Baisaran meadows"],              meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d6.id, day: 4, title: "Srinagar Sightseeing",   description: "Explore heritage and gardens of Srinagar.",       hotel_id: hotelGrand.id, activity_ids: [],                           activities: ["Mughal Gardens","Shankaracharya Temple","Local market"],      meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d6.id, day: 5, title: "Leisure and Shopping",   description: "Free day for shopping and leisure.",              hotel_id: hotelGrand.id, activity_ids: [actShikara.id],              activities: ["Pashmina shopping","Wazwan lunch","Sunset shikara"],          meals: ["Breakfast"]           },
    { package_id: pkg1.id, duration_id: p1d6.id, day: 6, title: "Departure",               description: "Check out and transfer to airport.",              hotel_id: null,          activity_ids: [],                           activities: ["Breakfast","Airport transfer"],                               meals: ["Breakfast"]           },
    { package_id: pkg1.id, duration_id: p1d4.id, day: 1, title: "Arrival in Srinagar",   description: "Arrive and check in.",                            hotel_id: hotelGrand.id, activity_ids: [actShikara.id],              activities: ["Airport pickup","Dal Lake shikara ride","Check-in"],          meals: ["Dinner"]              },
    { package_id: pkg1.id, duration_id: p1d4.id, day: 2, title: "Pahalgam Excursion",     description: "Drive to Pahalgam.",                              hotel_id: hotelDal.id,   activity_ids: [],                           activities: ["Betaab Valley","Aru Valley","Baisaran meadows"],              meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d4.id, day: 3, title: "Srinagar Sightseeing",   description: "Explore Srinagar.",                               hotel_id: hotelGrand.id, activity_ids: [],                           activities: ["Mughal Gardens","Shankaracharya Temple","Pashmina market"],   meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d4.id, day: 4, title: "Departure",               description: "Check out and transfer.",                         hotel_id: null,          activity_ids: [],                           activities: ["Breakfast","Airport transfer"],                               meals: ["Breakfast"]           },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 1, title: "Arrival in Srinagar",   description: "Arrive and check in.",                            hotel_id: hotelNehru.id, activity_ids: [actShikara.id],              activities: ["Airport pickup","Dal Lake shikara ride","Houseboat check-in"],meals: ["Dinner"]              },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 2, title: "Gulmarg Day Trip",       description: "Full day in Gulmarg.",                            hotel_id: hotelNehru.id, activity_ids: [actGondola.id, actSkiing.id], activities: ["Gondola ride","Snow activities","Skiing"],                    meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 3, title: "Pahalgam",               description: "Valley of shepherds.",                            hotel_id: hotelDal.id,   activity_ids: [],                           activities: ["Betaab Valley","Aru Valley"],                                 meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 4, title: "Sonmarg",                description: "Glacier and meadows.",                            hotel_id: hotelDal.id,   activity_ids: [],                           activities: ["Thajiwas Glacier","Meadow walk","Pony ride"],                 meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 5, title: "Srinagar Sightseeing",   description: "Explore heritage.",                               hotel_id: hotelNehru.id, activity_ids: [],                           activities: ["Mughal Gardens","Shankaracharya Temple"],                     meals: ["Breakfast","Dinner"]  },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 6, title: "Leisure",                description: "Shopping and leisure.",                           hotel_id: hotelNehru.id, activity_ids: [actShikara.id],              activities: ["Pashmina shopping","Wazwan lunch"],                           meals: ["Breakfast"]           },
    { package_id: pkg1.id, duration_id: p1d7.id, day: 7, title: "Departure",               description: "Check out and transfer.",                         hotel_id: null,          activity_ids: [],                           activities: ["Breakfast","Airport transfer"],                               meals: ["Breakfast"]           },
  ]});

  await db.package_images.createMany({ data: [
    { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400", alt: "Dal Lake Srinagar",  sort_order: 1, is_primary: true  },
    { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Gulmarg Snow",       sort_order: 2, is_primary: false },
    { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200", thumbnail: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=400", alt: "Pahalgam Valley",    sort_order: 3, is_primary: false },
    { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Mughal Garden",      sort_order: 4, is_primary: false },
    { package_id: pkg1.id, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200",    thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",    alt: "Shikara Dal Lake",   sort_order: 5, is_primary: false },
  ]});
  await db.package_hotels.createMany({ data: [{ package_id: pkg1.id, hotel_id: hotelDal.id,   stay_category_id: p1s1.id, is_recommended: false }, { package_id: pkg1.id, hotel_id: hotelGrand.id, stay_category_id: p1s2.id, is_recommended: true  }, { package_id: pkg1.id, hotel_id: hotelNehru.id, stay_category_id: p1s3.id, is_recommended: true  }]});
  await db.package_activities.createMany({ data: [{ package_id: pkg1.id, activity_id: actShikara.id, duration_id: p1d6.id, day_number: 1, is_optional: false }, { package_id: pkg1.id, activity_id: actGondola.id, duration_id: p1d6.id, day_number: 2, is_optional: false }, { package_id: pkg1.id, activity_id: actSkiing.id, duration_id: p1d6.id, day_number: 2, is_optional: true, extra_price: 3000 }]});
  await db.package_tags.createMany({ data: [{ package_id: pkg1.id, tag_id: tagSnow.id }, { package_id: pkg1.id, tag_id: tagAdventure.id }, { package_id: pkg1.id, tag_id: tagFamily.id }, { package_id: pkg1.id, tag_id: tagHoneymoon.id }, { package_id: pkg1.id, tag_id: tagWinter.id }]});
  await db.package_categories.createMany({ data: [{ package_id: pkg1.id, category_id: catHill.id }, { package_id: pkg1.id, category_id: catHoneymoon.id }]});
  console.log("✅ Package 1: Kashmir Grand Tour");

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 2 — Shimla Manali Classic
  // ══════════════════════════════════════════════════════════════════════════
  const pkg2 = await db.packages.create({ data: { title: "Shimla Manali Classic", slug: "shimla-manali-classic", destination_id: himachal.id, description: "The most popular Himachal circuit — colonial Shimla, Kufri snow and Manali adventure.", thumbnail: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=400", cover_image: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=1920", is_active: true } });

  const [p2s1, p2s2, p2s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg2.id, label: "Standard",     description: "2-3 star hotels",        sort_order: 1, is_default: false, is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg2.id, label: "Deluxe",       description: "4-star properties",      sort_order: 2, is_default: true,  is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg2.id, label: "Super Deluxe", description: "5-star luxury resorts",  sort_order: 3, is_default: false, min_duration_days: 6, is_active: true } }),
  ]);

  const [p2d5, p2d7, p2d9] = await Promise.all([
    db.package_durations.create({ data: { package_id: pkg2.id, slug: "5-days", label: "5 Days / 4 Nights", days: 5, nights: 4, is_default: false, sort_order: 1, meta_title: "Shimla Manali 5 Days | Dreams Yatri", meta_desc: "Quick Shimla Manali trip in 5 days.", routes: [{ id: 0, label: "Chandigarh → Shimla → Manali → Chandigarh", stops: ["Chandigarh","Shimla","Manali","Chandigarh"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg2.id, slug: "7-days", label: "7 Days / 6 Nights", days: 7, nights: 6, is_default: true,  sort_order: 2, meta_title: "Shimla Manali 7 Days | Dreams Yatri", meta_desc: "Most popular Shimla Manali tour with Solang Valley.", routes: [{ id: 0, label: "Chandigarh → Shimla → Manali → Chandigarh", stops: ["Chandigarh","Shimla","Kufri","Manali","Chandigarh"], is_default: true }, { id: 1, label: "Delhi → Shimla → Manali → Delhi", stops: ["Delhi","Shimla","Kufri","Manali","Delhi"], is_default: false }] } }),
    db.package_durations.create({ data: { package_id: pkg2.id, slug: "9-days", label: "9 Days / 8 Nights", days: 9, nights: 8, is_default: false, sort_order: 3, meta_title: "Shimla Manali Spiti 9 Days | Dreams Yatri", meta_desc: "Extended Himachal tour including Spiti Valley.", routes: [{ id: 0, label: "Delhi → Shimla → Manali → Spiti → Delhi", stops: ["Delhi","Shimla","Manali","Spiti","Delhi"], is_default: true }] } }),
  ]);

  await db.package_pricing.createMany({ data: [
    { package_id: pkg2.id, duration_id: p2d5.id, route_index: 0, stay_category_id: p2s1.id, price: 12999, original_price: 15999 },
    { package_id: pkg2.id, duration_id: p2d5.id, route_index: 0, stay_category_id: p2s2.id, price: 17999, original_price: 21999 },
    { package_id: pkg2.id, duration_id: p2d7.id, route_index: 0, stay_category_id: p2s1.id, price: 18999, original_price: 22999 },
    { package_id: pkg2.id, duration_id: p2d7.id, route_index: 0, stay_category_id: p2s2.id, price: 25999, original_price: 30999 },
    { package_id: pkg2.id, duration_id: p2d7.id, route_index: 1, stay_category_id: p2s1.id, price: 21999, original_price: 25999 },
    { package_id: pkg2.id, duration_id: p2d7.id, route_index: 1, stay_category_id: p2s2.id, price: 28999, original_price: 34999 },
    { package_id: pkg2.id, duration_id: p2d7.id, route_index: 1, stay_category_id: p2s3.id, price: 39999, original_price: 47999 },
    { package_id: pkg2.id, duration_id: p2d9.id, route_index: 0, stay_category_id: p2s1.id, price: 27999, original_price: 33999 },
    { package_id: pkg2.id, duration_id: p2d9.id, route_index: 0, stay_category_id: p2s2.id, price: 36999, original_price: 43999 },
    { package_id: pkg2.id, duration_id: p2d9.id, route_index: 0, stay_category_id: p2s3.id, price: 49999, original_price: 58999 },
  ]});

  await db.package_itineraries.createMany({ data: [
    { package_id: pkg2.id, duration_id: p2d7.id, day: 1, title: "Chandigarh to Shimla",  description: "Pickup and drive to Shimla.",                hotel_id: hotelPinewood.id, activity_ids: [],              activities: ["Pickup from Chandigarh","Mall Road walk","Hotel check-in"],         meals: ["Dinner"]             },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 2, title: "Shimla Sightseeing",    description: "Explore Shimla's best spots.",              hotel_id: hotelSnow.id,     activity_ids: [],              activities: ["Kufri snow point","Jakhu Temple","Christ Church","Mall Road"],       meals: ["Breakfast","Dinner"] },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 3, title: "Shimla to Manali",      description: "Scenic drive through Kullu Valley.",       hotel_id: hotelManu.id,     activity_ids: [],              activities: ["Scenic Kullu Valley drive","Kullu Maidan stop","Manali check-in"],  meals: ["Breakfast","Dinner"] },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 4, title: "Solang Valley",         description: "Adventure at Solang Valley.",               hotel_id: hotelManu.id,     activity_ids: [actRafting.id], activities: ["Ropeway ride","Snow activities","Zorbing","Paragliding option"],    meals: ["Breakfast","Dinner"] },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 5, title: "Manali Local",          description: "Explore Manali town.",                      hotel_id: hotelManu.id,     activity_ids: [actRafting.id], activities: ["Hadimba Temple","Old Manali","Vashisht hot springs","Rafting"],     meals: ["Breakfast","Dinner"] },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 6, title: "Rohtang Pass",          description: "Day excursion to Rohtang Pass.",            hotel_id: hotelManu.id,     activity_ids: [actRohtang.id], activities: ["Rohtang Pass excursion","Snow photography","Yak ride"],            meals: ["Breakfast","Dinner"] },
    { package_id: pkg2.id, duration_id: p2d7.id, day: 7, title: "Departure",              description: "Check out and drop to Chandigarh.",         hotel_id: null,             activity_ids: [],              activities: ["Breakfast","Drop to Chandigarh or Volvo bus"],                     meals: ["Breakfast"]          },
  ]});

  await db.package_images.createMany({ data: [
    { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=1200",    thumbnail: "https://images.unsplash.com/photo-1558618047-f4e60cef0008?w=400",    alt: "Manali snow view",   sort_order: 1, is_primary: true  },
    { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=1200", thumbnail: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=400", alt: "Shimla Mall Road",   sort_order: 2, is_primary: false },
    { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=1200", thumbnail: "https://images.unsplash.com/photo-1604537529428-15bcbeecfe4d?w=400", alt: "Solang Valley",      sort_order: 3, is_primary: false },
    { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=1200", thumbnail: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=400", alt: "Rohtang Pass",       sort_order: 4, is_primary: false },
    { package_id: pkg2.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Kufri snow",         sort_order: 5, is_primary: false },
  ]});
  await db.package_hotels.createMany({ data: [{ package_id: pkg2.id, hotel_id: hotelPinewood.id, stay_category_id: p2s1.id, is_recommended: false }, { package_id: pkg2.id, hotel_id: hotelSnow.id, stay_category_id: p2s2.id, is_recommended: true }, { package_id: pkg2.id, hotel_id: hotelManu.id, stay_category_id: p2s3.id, is_recommended: true }]});
  await db.package_activities.createMany({ data: [{ package_id: pkg2.id, activity_id: actRafting.id, duration_id: p2d7.id, day_number: 5, is_optional: true, extra_price: 1200 }, { package_id: pkg2.id, activity_id: actRohtang.id, duration_id: p2d7.id, day_number: 6, is_optional: false }]});
  await db.package_tags.createMany({ data: [{ package_id: pkg2.id, tag_id: tagSnow.id }, { package_id: pkg2.id, tag_id: tagAdventure.id }, { package_id: pkg2.id, tag_id: tagFamily.id }, { package_id: pkg2.id, tag_id: tagTrekking.id }, { package_id: pkg2.id, tag_id: tagSummer.id }]});
  await db.package_categories.createMany({ data: [{ package_id: pkg2.id, category_id: catHill.id }, { package_id: pkg2.id, category_id: catAdventure.id }]});
  console.log("✅ Package 2: Shimla Manali Classic");

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 3 — Goa Beach Holiday
  // ══════════════════════════════════════════════════════════════════════════
  const pkg3 = await db.packages.create({ data: { title: "Goa Beach Holiday", slug: "goa-beach-holiday", destination_id: goa.id, description: "Sun, sand, seafood and nightlife — complete Goa experience covering North and South Goa beaches.", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", cover_image: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1920", is_active: true } });

  const [p3s1, p3s2, p3s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg3.id, label: "Standard",     description: "3-star beach resorts",    sort_order: 1, is_default: false, is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg3.id, label: "Deluxe",       description: "4-star beachfront stays", sort_order: 2, is_default: true,  is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg3.id, label: "Luxury",       description: "5-star luxury resorts",   sort_order: 3, is_default: false, is_active: true } }),
  ]);

  const [p3d4, p3d6, p3d8] = await Promise.all([
    db.package_durations.create({ data: { package_id: pkg3.id, slug: "4-days", label: "4 Days / 3 Nights", days: 4, nights: 3, is_default: false, sort_order: 1, meta_title: "Goa 4 Days Package | Dreams Yatri", meta_desc: "Quick Goa getaway in 4 days.", routes: [{ id: 0, label: "Goa Airport → North Goa → Goa Airport", stops: ["Goa Airport","North Goa","Goa Airport"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg3.id, slug: "6-days", label: "6 Days / 5 Nights", days: 6, nights: 5, is_default: true,  sort_order: 2, meta_title: "Goa 6 Days Package | Dreams Yatri", meta_desc: "Complete Goa tour covering North and South.", routes: [{ id: 0, label: "Goa Airport → North Goa → South Goa → Goa Airport", stops: ["Goa Airport","North Goa","South Goa","Goa Airport"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg3.id, slug: "8-days", label: "8 Days / 7 Nights", days: 8, nights: 7, is_default: false, sort_order: 3, meta_title: "Goa 8 Days Package | Dreams Yatri", meta_desc: "Extended Goa holiday with Dudhsagar excursion.", routes: [{ id: 0, label: "Goa Airport → North Goa → South Goa → Dudhsagar → Goa Airport", stops: ["Goa Airport","North Goa","South Goa","Dudhsagar","Goa Airport"], is_default: true }] } }),
  ]);

  await db.package_pricing.createMany({ data: [
    { package_id: pkg3.id, duration_id: p3d4.id, route_index: 0, stay_category_id: p3s1.id, price: 11999, original_price: 14999 },
    { package_id: pkg3.id, duration_id: p3d4.id, route_index: 0, stay_category_id: p3s2.id, price: 16999, original_price: 20999 },
    { package_id: pkg3.id, duration_id: p3d6.id, route_index: 0, stay_category_id: p3s1.id, price: 16999, original_price: 20999 },
    { package_id: pkg3.id, duration_id: p3d6.id, route_index: 0, stay_category_id: p3s2.id, price: 24999, original_price: 29999 },
    { package_id: pkg3.id, duration_id: p3d6.id, route_index: 0, stay_category_id: p3s3.id, price: 39999, original_price: 47999 },
    { package_id: pkg3.id, duration_id: p3d8.id, route_index: 0, stay_category_id: p3s1.id, price: 21999, original_price: 26999 },
    { package_id: pkg3.id, duration_id: p3d8.id, route_index: 0, stay_category_id: p3s2.id, price: 31999, original_price: 38999 },
    { package_id: pkg3.id, duration_id: p3d8.id, route_index: 0, stay_category_id: p3s3.id, price: 52999, original_price: 62999 },
  ]});

  await db.package_itineraries.createMany({ data: [
    { package_id: pkg3.id, duration_id: p3d6.id, day: 1, title: "Arrival in Goa",           description: "Arrive and head to your beach resort.",   hotel_id: hotelSpice.id, activity_ids: [],              activities: ["Airport pickup","Hotel check-in","Calangute Beach sunset"],  meals: ["Dinner"]             },
    { package_id: pkg3.id, duration_id: p3d6.id, day: 2, title: "North Goa Tour",           description: "Explore the best of North Goa.",          hotel_id: hotelSpice.id, activity_ids: [actBeachGoa.id], activities: ["Baga Beach","Fort Aguada","Anjuna flea market","Nightlife"], meals: ["Breakfast","Dinner"] },
    { package_id: pkg3.id, duration_id: p3d6.id, day: 3, title: "Water Sports Day",         description: "Adventure on the waters of Goa.",         hotel_id: hotelSpice.id, activity_ids: [actBeachGoa.id], activities: ["Parasailing","Jet ski","Banana boat ride","Beach volleyball"], meals: ["Breakfast","Dinner"] },
    { package_id: pkg3.id, duration_id: p3d6.id, day: 4, title: "South Goa",               description: "Explore the peaceful South Goa.",         hotel_id: hotelLeela.id, activity_ids: [],              activities: ["Colva Beach","Basilica of Bom Jesus","Local seafood lunch"], meals: ["Breakfast","Dinner"] },
    { package_id: pkg3.id, duration_id: p3d6.id, day: 5, title: "Leisure Day",             description: "Relax on the beach.",                     hotel_id: hotelLeela.id, activity_ids: [],              activities: ["Beach relaxation","Spa treatment","Sunset cruise"],          meals: ["Breakfast","Dinner"] },
    { package_id: pkg3.id, duration_id: p3d6.id, day: 6, title: "Departure",               description: "Check out and transfer to airport.",      hotel_id: null,          activity_ids: [],              activities: ["Breakfast","Airport transfer"],                               meals: ["Breakfast"]          },
  ]});

  await db.package_images.createMany({ data: [
    { package_id: pkg3.id, url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Goa beach",          sort_order: 1, is_primary: true  },
    { package_id: pkg3.id, url: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=1200", thumbnail: "https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=400", alt: "Goa waterfall",      sort_order: 2, is_primary: false },
    { package_id: pkg3.id, url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Goa resort pool",    sort_order: 3, is_primary: false },
    { package_id: pkg3.id, url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200", thumbnail: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400", alt: "Goa sunset",         sort_order: 4, is_primary: false },
    { package_id: pkg3.id, url: "https://images.unsplash.com/photo-1531761535209-180857e963b9?w=1200", thumbnail: "https://images.unsplash.com/photo-1531761535209-180857e963b9?w=400", alt: "Goa fort",           sort_order: 5, is_primary: false },
  ]});
  await db.package_hotels.createMany({ data: [{ package_id: pkg3.id, hotel_id: hotelSpice.id, stay_category_id: p3s2.id, is_recommended: true }, { package_id: pkg3.id, hotel_id: hotelLeela.id, stay_category_id: p3s3.id, is_recommended: true }]});
  await db.package_activities.createMany({ data: [{ package_id: pkg3.id, activity_id: actBeachGoa.id, duration_id: p3d6.id, day_number: 2, is_optional: false }, { package_id: pkg3.id, activity_id: actDudhsagar.id, duration_id: p3d8.id, day_number: 7, is_optional: true, extra_price: 2000 }]});
  await db.package_tags.createMany({ data: [{ package_id: pkg3.id, tag_id: tagBeach.id }, { package_id: pkg3.id, tag_id: tagFamily.id }, { package_id: pkg3.id, tag_id: tagHoneymoon.id }, { package_id: pkg3.id, tag_id: tagSummer.id }, { package_id: pkg3.id, tag_id: tagAdventure.id }]});
  await db.package_categories.createMany({ data: [{ package_id: pkg3.id, category_id: catBeach.id }, { package_id: pkg3.id, category_id: catHoneymoon.id }]});
  console.log("✅ Package 3: Goa Beach Holiday");

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 4 — Rajasthan Royal Tour
  // ══════════════════════════════════════════════════════════════════════════
  const pkg4 = await db.packages.create({ data: { title: "Rajasthan Royal Tour", slug: "rajasthan-royal-tour", destination_id: rajasthan.id, description: "Discover the land of maharajas — majestic forts, vibrant markets, camel safaris and royal palace stays.", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", cover_image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1920", is_active: true } });

  const [p4s1, p4s2, p4s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg4.id, label: "Standard",  description: "Heritage hotels 3-star",    sort_order: 1, is_default: false, is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg4.id, label: "Deluxe",    description: "4-star palace properties",  sort_order: 2, is_default: true,  is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg4.id, label: "Royal",     description: "5-star royal palace stays", sort_order: 3, is_default: false, is_active: true } }),
  ]);

  const [p4d6, p4d8, p4d10] = await Promise.all([
    db.package_durations.create({ data: { package_id: pkg4.id, slug: "6-days", label: "6 Days / 5 Nights", days: 6, nights: 5, is_default: false, sort_order: 1, meta_title: "Rajasthan 6 Days Tour | Dreams Yatri", meta_desc: "Golden Triangle of Rajasthan in 6 days.", routes: [{ id: 0, label: "Delhi → Jaipur → Agra → Delhi", stops: ["Delhi","Jaipur","Agra","Delhi"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg4.id, slug: "8-days", label: "8 Days / 7 Nights", days: 8, nights: 7, is_default: true,  sort_order: 2, meta_title: "Rajasthan 8 Days Tour | Dreams Yatri", meta_desc: "Complete Rajasthan experience — Jaipur, Jodhpur, Jaisalmer.", routes: [{ id: 0, label: "Delhi → Jaipur → Jodhpur → Jaisalmer → Delhi", stops: ["Delhi","Jaipur","Jodhpur","Jaisalmer","Delhi"], is_default: true }, { id: 1, label: "Delhi → Jaipur → Udaipur → Jodhpur → Delhi", stops: ["Delhi","Jaipur","Udaipur","Jodhpur","Delhi"], is_default: false }] } }),
    db.package_durations.create({ data: { package_id: pkg4.id, slug: "10-days", label: "10 Days / 9 Nights", days: 10, nights: 9, is_default: false, sort_order: 3, meta_title: "Rajasthan 10 Days Tour | Dreams Yatri", meta_desc: "Grand Rajasthan circuit covering all major cities.", routes: [{ id: 0, label: "Delhi → Jaipur → Jodhpur → Jaisalmer → Udaipur → Delhi", stops: ["Delhi","Jaipur","Jodhpur","Jaisalmer","Udaipur","Delhi"], is_default: true }] } }),
  ]);

  await db.package_pricing.createMany({ data: [
    { package_id: pkg4.id, duration_id: p4d6.id,  route_index: 0, stay_category_id: p4s1.id, price: 18999, original_price: 22999 },
    { package_id: pkg4.id, duration_id: p4d6.id,  route_index: 0, stay_category_id: p4s2.id, price: 26999, original_price: 32999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 0, stay_category_id: p4s1.id, price: 24999, original_price: 29999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 0, stay_category_id: p4s2.id, price: 34999, original_price: 41999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 0, stay_category_id: p4s3.id, price: 54999, original_price: 64999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 1, stay_category_id: p4s1.id, price: 27999, original_price: 33999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 1, stay_category_id: p4s2.id, price: 37999, original_price: 45999 },
    { package_id: pkg4.id, duration_id: p4d8.id,  route_index: 1, stay_category_id: p4s3.id, price: 59999, original_price: 70999 },
    { package_id: pkg4.id, duration_id: p4d10.id, route_index: 0, stay_category_id: p4s1.id, price: 31999, original_price: 38999 },
    { package_id: pkg4.id, duration_id: p4d10.id, route_index: 0, stay_category_id: p4s2.id, price: 44999, original_price: 53999 },
    { package_id: pkg4.id, duration_id: p4d10.id, route_index: 0, stay_category_id: p4s3.id, price: 71999, original_price: 84999 },
  ]});

  await db.package_itineraries.createMany({ data: [
    { package_id: pkg4.id, duration_id: p4d8.id, day: 1, title: "Arrival in Jaipur",       description: "Arrive in the Pink City.",              hotel_id: hotelHeritage.id, activity_ids: [],              activities: ["Airport pickup","Hotel check-in","Hawa Mahal visit"],            meals: ["Dinner"]             },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 2, title: "Jaipur Sightseeing",      description: "Explore the forts and palaces.",        hotel_id: hotelHeritage.id, activity_ids: [actElephant.id], activities: ["Amber Fort","City Palace","Jantar Mantar","Elephant Village"], meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 3, title: "Jaipur Markets",          description: "Shopping and local experience.",        hotel_id: hotelHeritage.id, activity_ids: [],              activities: ["Johari Bazaar","Block printing workshop","Local cuisine tour"],  meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 4, title: "Jaipur to Jodhpur",       description: "Drive to the Blue City.",               hotel_id: hotelRaj.id,      activity_ids: [],              activities: ["Scenic drive","Mehrangarh Fort","Jaswant Thada"],               meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 5, title: "Jodhpur Exploration",     description: "Explore the Blue City.",                hotel_id: hotelRaj.id,      activity_ids: [],              activities: ["Umaid Bhawan Museum","Clock Tower market","Sunset at fort"],    meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 6, title: "Jodhpur to Jaisalmer",    description: "Drive to the Golden City.",             hotel_id: hotelRaj.id,      activity_ids: [actCamel.id],   activities: ["Jaisalmer Fort","Patwon Ki Haveli","Camel safari sunset"],      meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 7, title: "Jaisalmer Desert",        description: "Desert camp experience.",               hotel_id: hotelRaj.id,      activity_ids: [actCamel.id],   activities: ["Sam Sand Dunes","Desert camp","Cultural program","Bonfire"],     meals: ["Breakfast","Dinner"] },
    { package_id: pkg4.id, duration_id: p4d8.id, day: 8, title: "Departure",               description: "Return to Delhi.",                      hotel_id: null,             activity_ids: [],              activities: ["Breakfast","Drive to Delhi airport"],                           meals: ["Breakfast"]          },
  ]});

  await db.package_images.createMany({ data: [
    { package_id: pkg4.id, url: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200", thumbnail: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400", alt: "Rajasthan palace",   sort_order: 1, is_primary: true  },
    { package_id: pkg4.id, url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Amber Fort Jaipur",  sort_order: 2, is_primary: false },
    { package_id: pkg4.id, url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200", thumbnail: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400", alt: "Jaisalmer fort",     sort_order: 3, is_primary: false },
    { package_id: pkg4.id, url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200",    thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",    alt: "Rajasthan desert",   sort_order: 4, is_primary: false },
    { package_id: pkg4.id, url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200", thumbnail: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400", alt: "Jodhpur blue city",  sort_order: 5, is_primary: false },
  ]});
  await db.package_hotels.createMany({ data: [{ package_id: pkg4.id, hotel_id: hotelHeritage.id, stay_category_id: p4s2.id, is_recommended: true }, { package_id: pkg4.id, hotel_id: hotelRaj.id, stay_category_id: p4s3.id, is_recommended: true }]});
  await db.package_activities.createMany({ data: [{ package_id: pkg4.id, activity_id: actCamel.id, duration_id: p4d8.id, day_number: 6, is_optional: false }, { package_id: pkg4.id, activity_id: actElephant.id, duration_id: p4d8.id, day_number: 2, is_optional: true, extra_price: 2000 }]});
  await db.package_tags.createMany({ data: [{ package_id: pkg4.id, tag_id: tagAdventure.id }, { package_id: pkg4.id, tag_id: tagFamily.id }, { package_id: pkg4.id, tag_id: tagLuxury.id }, { package_id: pkg4.id, tag_id: tagHoneymoon.id }, { package_id: pkg4.id, tag_id: tagWinter.id }]});
  await db.package_categories.createMany({ data: [{ package_id: pkg4.id, category_id: catCultural.id }, { package_id: pkg4.id, category_id: catHoneymoon.id }]});
  console.log("✅ Package 4: Rajasthan Royal Tour");

  // ══════════════════════════════════════════════════════════════════════════
  // PACKAGE 5 — Kerala Backwaters & Hills
  // ══════════════════════════════════════════════════════════════════════════
  const pkg5 = await db.packages.create({ data: { title: "Kerala Backwaters & Hills", slug: "kerala-backwaters-hills", destination_id: kerala.id, description: "Experience God's Own Country — serene backwater cruises, misty hill stations, ayurvedic spas and spice plantations.", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", cover_image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1920", is_active: true } });

  const [p5s1, p5s2, p5s3] = await Promise.all([
    db.package_stay_categories.create({ data: { package_id: pkg5.id, label: "Standard",  description: "3-star resorts and homestays",    sort_order: 1, is_default: false, is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg5.id, label: "Deluxe",    description: "4-star backwater resorts",        sort_order: 2, is_default: true,  is_active: true } }),
    db.package_stay_categories.create({ data: { package_id: pkg5.id, label: "Luxury",    description: "5-star lake resorts with houseboat", sort_order: 3, is_default: false, is_active: true } }),
  ]);

  const [p5d5, p5d7, p5d9] = await Promise.all([
    db.package_durations.create({ data: { package_id: pkg5.id, slug: "5-days", label: "5 Days / 4 Nights", days: 5, nights: 4, is_default: false, sort_order: 1, meta_title: "Kerala 5 Days Package | Dreams Yatri", meta_desc: "Quick Kerala escape with backwaters and Munnar.", routes: [{ id: 0, label: "Kochi → Munnar → Alleppey → Kochi", stops: ["Kochi","Munnar","Alleppey","Kochi"], is_default: true }] } }),
    db.package_durations.create({ data: { package_id: pkg5.id, slug: "7-days", label: "7 Days / 6 Nights", days: 7, nights: 6, is_default: true,  sort_order: 2, meta_title: "Kerala 7 Days Package | Dreams Yatri", meta_desc: "Complete Kerala experience — Munnar, Thekkady, Alleppey.", routes: [{ id: 0, label: "Kochi → Munnar → Thekkady → Alleppey → Kochi", stops: ["Kochi","Munnar","Thekkady","Alleppey","Kochi"], is_default: true }, { id: 1, label: "Kochi → Munnar → Alleppey → Kovalam → Kochi", stops: ["Kochi","Munnar","Alleppey","Kovalam","Kochi"], is_default: false }] } }),
    db.package_durations.create({ data: { package_id: pkg5.id, slug: "9-days", label: "9 Days / 8 Nights", days: 9, nights: 8, is_default: false, sort_order: 3, meta_title: "Kerala 9 Days Package | Dreams Yatri", meta_desc: "Grand Kerala tour with all major destinations.", routes: [{ id: 0, label: "Kochi → Munnar → Thekkady → Alleppey → Kovalam → Kochi", stops: ["Kochi","Munnar","Thekkady","Alleppey","Kovalam","Kochi"], is_default: true }] } }),
  ]);

  await db.package_pricing.createMany({ data: [
    { package_id: pkg5.id, duration_id: p5d5.id, route_index: 0, stay_category_id: p5s1.id, price: 16999, original_price: 20999 },
    { package_id: pkg5.id, duration_id: p5d5.id, route_index: 0, stay_category_id: p5s2.id, price: 23999, original_price: 28999 },
    { package_id: pkg5.id, duration_id: p5d7.id, route_index: 0, stay_category_id: p5s1.id, price: 22999, original_price: 27999 },
    { package_id: pkg5.id, duration_id: p5d7.id, route_index: 0, stay_category_id: p5s2.id, price: 32999, original_price: 39999 },
    { package_id: pkg5.id, duration_id: p5d7.id, route_index: 0, stay_category_id: p5s3.id, price: 52999, original_price: 62999 },
    { package_id: pkg5.id, duration_id: p5d7.id, route_index: 1, stay_category_id: p5s1.id, price: 24999, original_price: 29999 },
    { package_id: pkg5.id, duration_id: p5d7.id, route_index: 1, stay_category_id: p5s2.id, price: 34999, original_price: 41999 },
    { package_id: pkg5.id, duration_id: p5d9.id, route_index: 0, stay_category_id: p5s1.id, price: 29999, original_price: 35999 },
    { package_id: pkg5.id, duration_id: p5d9.id, route_index: 0, stay_category_id: p5s2.id, price: 42999, original_price: 51999 },
    { package_id: pkg5.id, duration_id: p5d9.id, route_index: 0, stay_category_id: p5s3.id, price: 67999, original_price: 80999 },
  ]});

  await db.package_itineraries.createMany({ data: [
    { package_id: pkg5.id, duration_id: p5d7.id, day: 1, title: "Arrival in Kochi",        description: "Arrive in Kochi — the gateway to Kerala.",  hotel_id: hotelKerala.id,  activity_ids: [],               activities: ["Airport pickup","Fort Kochi walk","Chinese fishing nets","Kathakali show"], meals: ["Dinner"]             },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 2, title: "Kochi to Munnar",         description: "Drive to the tea country.",                  hotel_id: hotelKerala.id,  activity_ids: [],               activities: ["Tea plantation visit","Eravikulam National Park","Mattupetty Dam"],        meals: ["Breakfast","Dinner"] },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 3, title: "Munnar Hills",            description: "Explore the misty hills of Munnar.",        hotel_id: hotelKerala.id,  activity_ids: [],               activities: ["Top Station viewpoint","Tea Museum","Spice market","Sunrise trek"],        meals: ["Breakfast","Dinner"] },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 4, title: "Munnar to Thekkady",      description: "Drive to Periyar Wildlife Sanctuary.",      hotel_id: hotelSpiceK.id,  activity_ids: [],               activities: ["Periyar Lake boat ride","Spice plantation tour","Elephant interaction"],   meals: ["Breakfast","Dinner"] },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 5, title: "Thekkady to Alleppey",   description: "Drive to the backwaters.",                  hotel_id: hotelKerala.id,  activity_ids: [actHouseboat.id], activities: ["Houseboat check-in","Backwater cruise","Village visit","Sunset"],         meals: ["Breakfast","Dinner"] },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 6, title: "Backwaters & Ayurveda",  description: "Relax on the houseboat.",                   hotel_id: hotelKerala.id,  activity_ids: [actAyurveda.id], activities: ["Morning yoga","Ayurvedic massage","Kerala cuisine class","Shikara ride"],  meals: ["Breakfast","Dinner"] },
    { package_id: pkg5.id, duration_id: p5d7.id, day: 7, title: "Departure from Kochi",   description: "Transfer to Kochi airport.",                hotel_id: null,            activity_ids: [],               activities: ["Breakfast","Transfer to Kochi airport"],                                  meals: ["Breakfast"]          },
  ]});

  await db.package_images.createMany({ data: [
    { package_id: pkg5.id, url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200", thumbnail: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400", alt: "Kerala backwaters",    sort_order: 1, is_primary: true  },
    { package_id: pkg5.id, url: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=1200", thumbnail: "https://images.unsplash.com/photo-1540541338537-6c7aa22d8a27?w=400", alt: "Kerala houseboat",     sort_order: 2, is_primary: false },
    { package_id: pkg5.id, url: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=1200",    thumbnail: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?w=400",    alt: "Munnar tea gardens",   sort_order: 3, is_primary: false },
    { package_id: pkg5.id, url: "https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?w=1200", thumbnail: "https://images.unsplash.com/photo-1574482620811-1aa16ffe3c82?w=400", alt: "Kerala forest",        sort_order: 4, is_primary: false },
    { package_id: pkg5.id, url: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200", thumbnail: "https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=400", alt: "Kerala temple",        sort_order: 5, is_primary: false },
  ]});
  await db.package_hotels.createMany({ data: [{ package_id: pkg5.id, hotel_id: hotelKerala.id, stay_category_id: p5s2.id, is_recommended: true }, { package_id: pkg5.id, hotel_id: hotelSpiceK.id, stay_category_id: p5s3.id, is_recommended: true }]});
  await db.package_activities.createMany({ data: [{ package_id: pkg5.id, activity_id: actHouseboat.id, duration_id: p5d7.id, day_number: 5, is_optional: false }, { package_id: pkg5.id, activity_id: actAyurveda.id, duration_id: p5d7.id, day_number: 6, is_optional: true, extra_price: 3500 }]});
  await db.package_tags.createMany({ data: [{ package_id: pkg5.id, tag_id: tagFamily.id }, { package_id: pkg5.id, tag_id: tagHoneymoon.id }, { package_id: pkg5.id, tag_id: tagLuxury.id }, { package_id: pkg5.id, tag_id: tagWildlife.id }, { package_id: pkg5.id, tag_id: tagSummer.id }]});
  await db.package_categories.createMany({ data: [{ package_id: pkg5.id, category_id: catHoneymoon.id }, { package_id: pkg5.id, category_id: catWildlife.id }]});
  console.log("✅ Package 5: Kerala Backwaters & Hills");

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    db.regions.count(), db.destinations.count(), db.categories.count(), db.tags.count(),
    db.packages.count(), db.package_durations.count(), db.package_stay_categories.count(),
    db.package_pricing.count(), db.package_itineraries.count(),
    db.hotels.count(), db.hotel_rooms.count(), db.activities.count(),
    db.package_hotels.count(), db.package_activities.count(),
    db.hotel_images.count(), db.activity_images.count(), db.package_images.count(),
  ]);

  console.log("\n📊 Seed Summary:");
  console.log(`   regions                 → ${counts[0]}`);
  console.log(`   destinations            → ${counts[1]}`);
  console.log(`   categories              → ${counts[2]}`);
  console.log(`   tags                    → ${counts[3]}`);
  console.log(`   packages                → ${counts[4]}`);
  console.log(`   package_durations       → ${counts[5]}`);
  console.log(`   package_stay_categories → ${counts[6]}`);
  console.log(`   package_pricing         → ${counts[7]}`);
  console.log(`   package_itineraries     → ${counts[8]}`);
  console.log(`   hotels                  → ${counts[9]}`);
  console.log(`   hotel_rooms             → ${counts[10]}`);
  console.log(`   activities              → ${counts[11]}`);
  console.log(`   package_hotels          → ${counts[12]}`);
  console.log(`   package_activities      → ${counts[13]}`);
  console.log(`   hotel_images            → ${counts[14]}`);
  console.log(`   activity_images         → ${counts[15]}`);
  console.log(`   package_images          → ${counts[16]}`);
  console.log("\n✅ Seeding complete.");
}

seed()
  .catch(console.error)
  .finally(async () => { await db.$disconnect(); await pool.end(); });