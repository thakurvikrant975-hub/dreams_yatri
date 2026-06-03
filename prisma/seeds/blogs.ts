/**
 * Blog seed — creates categories, tags, a seed author, and 8 realistic blog posts.
 * Re-runnable: uses upsert / deleteMany + create so it is safe to run multiple times.
 *
 * Run:  npx tsx --env-file=.env prisma/seeds/blogs.ts
 */

import { PrismaClient } from "../../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Minimal valid Tiptap JSON document */
function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}
function h2(text: string) {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}
function h3(text: string) {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}
function p(...children: object[]) {
  return { type: "paragraph", content: children };
}
function t(text: string, marks?: object[]) {
  return marks ? { type: "text", text, marks } : { type: "text", text };
}
function bold(text: string) {
  return t(text, [{ type: "bold" }]);
}
function italic(text: string) {
  return t(text, [{ type: "italic" }]);
}
function ul(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [p(t(item))],
    })),
  };
}
function ol(...items: string[]) {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [p(t(item))],
    })),
  };
}
function blockquote(text: string) {
  return { type: "blockquote", content: [p(t(text))] };
}
function hr() {
  return { type: "horizontalRule" };
}

// ── Content library ───────────────────────────────────────────────────────────

const CONTENTS = {
  kashmir: doc(
    p(italic("There is a reason poets have called Kashmir 'Jannat' — Heaven on Earth. After three trips, I still struggle to put it into words.")),
    h2("The Valley That Stops Time"),
    p(t("The moment your flight descends over the Kashmir Valley, the world changes. A carpet of chinar trees in every shade of orange and gold stretches to the foot of snow-dusted mountains, and the Dal Lake catches the last of the afternoon light like a mirror dropped into the hills. Nothing quite prepares you for it — not the photographs, not the documentaries, and certainly not whatever you imagined on the flight up.")),
    p(t("I first visited in October, which locals will tell you is the sweet spot between the post-monsoon flush and the first serious snowfall. The crowds thin out, the hotels drop their prices, and the valley is dressed in its most theatrical colours.")),
    h2("Dal Lake — More Than a Postcard"),
    p(t("Most visitors spend their nights on a houseboat on Dal Lake, and I'd strongly recommend doing the same. Our houseboat — a beautifully carved cedar vessel — sat among a cluster of shikara boats selling saffron, papier-mâché crafts, and willow wicker baskets at dawn. The shikara ride at sunrise costs around ₹300 and lasts about an hour.")),
    p(t("What surprises people is how Dal Lake is actually a functioning community. Vegetable growers tend floating gardens called "), bold("'rad'"), t(", children row themselves to school in tiny wooden boats, and a whole economy of weavers, carpenters, and craftspeople operates entirely on the water.")),
    h2("Gulmarg: Snow in September"),
    p(t("A two-hour drive from Srinagar takes you to Gulmarg, a meadow town sitting at 2,650 metres that turns into a ski resort in winter. We visited in late September, before the snow arrived in earnest, and rode the Gondola — one of the highest cable cars in the world — to Kongdori (Phase I) at 3,080 metres.")),
    p(t("At the top, the air is thin enough to make your head swim slightly, and the views stretch across to Nanga Parbat on a clear day. Dress in warm layers; even in September the wind at altitude is sharp.")),
    h2("The Food You Cannot Miss"),
    ul(
      "Wazwan — a 36-course feast at a traditional household or reputable restaurant",
      "Rogan Josh from Ahdoos on Residency Road, Srinagar",
      "Kashmiri Kahwa (saffron-spiced green tea) at dawn on the houseboat",
      "Sheermal (saffron bread) from the old town bakeries",
      "Modur Pulao (sweet rice with dried fruits) as a dessert course",
    ),
    h2("Practical Notes"),
    p(bold("Getting there: "), t("Direct flights from Delhi, Mumbai, and Bengaluru to Srinagar. The drive from Jammu via the national highway takes 8–10 hours and passes through the Banihal Tunnel.")),
    p(bold("Best time: "), t("March–May for flowers (tulips peak in April), September–November for autumn foliage, December–February for heavy snow and skiing.")),
    p(bold("Budget tip: "), t("Book houseboats directly rather than through aggregators — owners often give significantly better rates and include meals.")),
    blockquote("Kashmir is not a destination you visit once and tick off a list. It is a place that quietly rearranges your understanding of beauty, and then waits patiently for you to return."),
  ),

  spiti: doc(
    p(italic("A thousand metres above the treeline, where tarmac turns to gravel and the air tastes like cold stone, you enter a different world.")),
    h2("What Is Spiti Valley?"),
    p(t("Spiti is a high-altitude cold desert in the north-eastern corner of Himachal Pradesh, bordered by Tibet to the east and Lahaul to the west. It sits at an average elevation of 3,800 metres — higher than most European peaks — and is cut off by snow for five to six months every year. That isolation is precisely what makes it extraordinary.")),
    p(t("The landscape is raw and theatrical: terracotta cliffs striped in iron-red and ochre, the turquoise ribbon of the Spiti River threading through a valley floor bleached bone-white by altitude, and ancient Buddhist monasteries clinging to ridgelines as though placed there by something other than human hands.")),
    h2("Manali–Spiti vs Shimla–Spiti"),
    p(t("There are two ways in. Most tourists take the Manali–Spiti route via the Rohtang and Kunzum passes, which is only open from June to October. The Shimla–Spiti route via Kinnaur (the Hindustan-Tibet Highway) is open nearly year-round but involves more days of driving on narrow mountain roads with dramatic drops.")),
    p(t("We did both — in via Manali, out via Kinnaur — which I'd recommend. The contrast between the two landscapes (barren moonscape coming in, apple orchards and pine forests going out) makes for a richer trip.")),
    h2("Three Places You Cannot Skip"),
    h3("Key Monastery"),
    p(t("Built in the 11th century, Key Monastery sits at 4,166 metres above a bend in the river and looks precisely like every idealised image you've ever had of a Himalayan gompa. Monks in crimson robes carry buckets of water up stone steps in the early morning. The prayer hall holds a 500-year-old thangka that the monks will show you if you arrive before the afternoon ceremonies.")),
    h3("Chandratal Lake"),
    p(t("A crescent-shaped glacial lake at 4,300 metres, Chandratal is arguably the most beautiful body of water in India. The water shifts colour as clouds move across the sun — from turquoise to emerald to a deep Prussian blue. Access is via a 3 km walk from the campsite at Kunzum Pass; vehicles are not permitted near the lake.")),
    h3("Langza Village"),
    p(t("At 4,400 metres, Langza is the highest permanently inhabited village in the world. Its claim to fame: a 1,000-year-old Buddha statue on a ridge overlooking the valley, and the fact that the entire valley floor around it is a Tethys Sea fossil bed. Walk any direction from the village and you will find ammonite and marine fossils embedded in the rock — remnants of the ancient ocean that once covered what is now the Himalayas.")),
    h2("Altitude Sickness — Take It Seriously"),
    p(bold("Acclimatise before ascending. "), t("Spend at least two nights in Manali (2,050 m) before crossing Rohtang Pass. Eat light, stay hydrated, and avoid alcohol for the first 48 hours. Symptoms of Acute Mountain Sickness (AMS) include headache, nausea, and disorientation. If they appear, descend immediately.")),
    h2("Best Time to Visit"),
    ul(
      "July – September: Roads open, wildflowers in bloom, best weather",
      "October: Harvest season, crisp air, very few other tourists",
      "Avoid June if possible — Rohtang Pass gets extremely congested",
    ),
    blockquote("Spiti has a way of making everything you thought mattered feel temporarily unimportant. The mountains are indifferent to schedules and ambitions. Spend enough time here and you start to feel that too, and it is not unpleasant."),
  ),

  kerala: doc(
    p(italic("Kerala moves at the pace of the backwater — slow, deliberate, and utterly unhurried. That is not a complaint.")),
    h2("Why Kerala Is Different"),
    p(t("Kerala is a narrow state — never more than 120 kilometres wide — pinched between the Western Ghats and the Arabian Sea. That geography gives it an extraordinary density of landscapes: tea estates and elephant corridors in the hills, river systems and paddy fields in the midlands, and 590 kilometres of coastline and inland waterways along the coast.")),
    p(t("The backwaters — a network of lakes, canals, and rivers that run parallel to the sea — are the most famous feature, but they are just one layer. Kerala has some of India's finest wildlife reserves, its own classical dance form (Kathakali), and a culinary tradition built on coconut, curry leaves, and black pepper that is completely distinct from the rest of South India.")),
    h2("The Backwaters: Alleppey vs Kumarakom"),
    p(t("Alleppey (Alappuzha) and Kumarakom are the two main houseboat hubs, and they are genuinely different experiences.")),
    p(bold("Alleppey "), t("is the busier, more social option. The canal network is wide enough for dozens of houseboats to move alongside each other, and the town has a beach, a working fishing harbour, and plenty of budget guesthouses. If you are travelling with children or a group, this is the better base.")),
    p(bold("Kumarakom "), t("is quieter and more expensive. The village sits on the eastern shore of Vembanad Lake — the longest lake in India — and the surrounding wetlands are a protected bird sanctuary. At dawn, the lake is covered in mist and dotted with egrets and painted storks.")),
    h2("Munnar: Tea Country"),
    p(t("Three hours inland from Kochi, Munnar sits at 1,600 metres and is surrounded by some of the most productive tea estates in the world. The drive up through the ghats — past spice gardens, rubber plantations, and waterfalls — is itself a reason to visit.")),
    p(t("The tea museum run by the Tata Tea company (KDHP) is genuinely excellent and costs only ₹75. Guides walk you through the full process from leaf to packet, and the tasting room at the end lets you compare six different grades of Munnar orthodox tea.")),
    h2("What to Eat"),
    ul(
      "Karimeen pollichathu — pearl spot fish wrapped in banana leaf and grilled over coals",
      "Kerala sadya — a 28-dish vegetarian feast served on a banana leaf (mandatory on Onam)",
      "Puttu and kadala curry — steamed rice cylinders with spiced chickpea curry, the quintessential breakfast",
      "Prawn moilee — coconut milk prawn curry from coastal Alleppey",
      "Banana fritters (pazham pori) — sold at every tea shop in the state",
    ),
    h2("Practical Tips"),
    p(bold("Avoid December–January "), t("if you dislike crowds — every resort in the state is full and prices double. March–May is hot but relatively quiet.")),
    p(bold("Book houseboats in advance "), t("for peak season (October–March). Many of the premium kettuvallam (traditional rice barges converted to houseboats) sell out months ahead.")),
    p(bold("Hire a car, not a tourist bus. "), t("Kerala's most rewarding experiences — a morning fog lifting over a paddy field, a sudden roadside shrine decorated with marigolds, a random jackfruit market — happen between the destinations. A self-drive or private car lets you stop.")),
  ),

  goa_budget: doc(
    p(italic("The internet will tell you Goa is expensive. The internet is wrong — or at least it is talking about a very specific version of Goa that you are not obliged to visit.")),
    h2("North Goa vs South Goa"),
    p(t("This distinction is real and matters for budget travel. North Goa — Baga, Calangute, Anjuna — is the party belt. It has the clubs, the big beach shacks, and the package tourists. It is also significantly more expensive, louder, and more crowded.")),
    p(t("South Goa is different. "), bold("Palolem, Agonda, Butterfly Beach, Cabo de Rama "), t("— these are quieter, cleaner, and almost uniformly cheaper. A beach hut on Palolem costs ₹800–₹1,400 per night in season (November–March), while a hut with the same view on Baga would cost twice that.")),
    h2("Where to Stay for Under ₹1,200/Night"),
    ul(
      "Palolem — Papillon Beach Resort or Bhakti Kutir (eco-huts)",
      "Agonda — Sam's Beach Resort or White Sand Beach Resort",
      "Arambol — most guesthouses on the cliff path above the beach",
      "Anjuna/Vagator — if you must be in north Goa, look at the lanes 500m from the beach",
    ),
    h2("Food Strategy"),
    p(t("The single biggest variable in a Goa budget is food. Beach shacks that put tables on the sand charge a "), bold("30–40% premium "), t("over the exact same dish served at an identical kitchen 100 metres inland. The golden rule: sit down to eat where local motorcyclists are eating.")),
    p(t("Some specific budget favourites:")),
    ul(
      "Café Bhosle, Panjim — fish thali for ₹120, the best value in the state capital",
      "Ravi's Canteen near Mapusa — prawn curry and rice for ₹180",
      "Any Udupi restaurant — south Indian breakfasts under ₹100 everywhere",
      "The bread man who cycles through Palolem at 7am — sliced bread + peanut butter ₹40",
    ),
    h2("Free and Cheap Activities"),
    ol(
      "Sunrise swim at Palolem before the tourists arrive (free)",
      "Butterfly Beach boat trip from Palolem — shared boat ₹150 return",
      "Rent a scooter for ₹350/day and explore the Portuguese churches in Old Goa",
      "Saturday Night Market at Arpora — entry free, great for people-watching",
      "Dudhsagar Falls day trip — jeep safari from Mollem ₹2,500 per jeep (split 6 ways)",
    ),
    h2("The Numbers"),
    p(t("A realistic daily budget for Goa, doing it properly:")),
    ul(
      "Accommodation (beach hut, south Goa): ₹900",
      "Breakfast (banana pancake + chai at guesthouse): ₹120",
      "Lunch (fish thali, inland): ₹180",
      "Dinner (beach shack, one beer): ₹450",
      "Scooter rental: ₹350",
      "Miscellaneous (sunscreen, coconut, boat trip amortised): ₹200",
      "TOTAL: ₹2,200/day",
    ),
    p(t("Over a 7-day trip that is ₹15,400 — well under the ₹5,000 headline claim (that works if you are very spartan), but still dramatically cheaper than most Indian city breaks.")),
    blockquote("The secret to Goa is not to fight what it is. Go slow, wake early, eat where the fishermen eat, and swim before 9am. The expensive version of Goa is optional."),
  ),

  honeymoon_coorg: doc(
    p(italic("We almost picked Shimla. I am glad we did not.")),
    h2("Why Coorg for a Honeymoon?"),
    p(t("Coorg (officially Kodagu) is a hill district in Karnataka, roughly 250 kilometres from Bengaluru, that sits at about 1,500 metres and receives some of the heaviest rainfall in India. That rainfall is the reason the whole district is covered in coffee estates, spice gardens, and mist-wrapped forests — it is extraordinarily green and, for most of the year, cool enough for sweaters in the evening.")),
    p(t("It also has almost none of the crowd-and-queue infrastructure of more famous honeymoon destinations. There is no mall road, no cable car queue, no tour bus convoy. The things you do here — walk through a coffee estate at dawn, sit on a verandah with the mist coming in from the valley, drive to a waterfall on roads almost entirely free of traffic — are things you do at your own pace.")),
    h2("Where We Stayed"),
    p(t("We booked three nights at a property about 8 kilometres from Madikeri, the district headquarters, on a working coffee estate. The room was a converted estate worker's cottage — low ceilings, thick stone walls, wood floors — overlooking a valley of coffee bushes that turned gold in the afternoon light.")),
    p(t("The owner, a third-generation planter, took us through the estate each morning. We learned to identify Arabica from Robusta by the shape of the leaf, found cardamom hiding under waxy green canopies, and picked pepper corns off the vine that climbed the estate trees. None of this was staged for tourists. It was simply how the family ran the estate.")),
    h2("Abbey Falls and the Drive"),
    p(t("Abbey Falls is 10 kilometres from Madikeri and is one of the most photographed spots in Coorg. The falls themselves are fine — about 70 feet, reasonably dramatic, surrounded by overhanging trees. What I will actually remember is the drive there: a narrow road through coffee and pepper estates, mist thickening as we climbed, the smell of coffee blossom in the air. We pulled over three times for nothing in particular. That is Coorg.")),
    h2("Practical Information"),
    p(bold("Getting there: "), t("Bengaluru to Madikeri is a 4–5 hour drive (via Mysuru). There is no railway station in Coorg — the nearest railheads are Mysuru (120 km) and Mangaluru (135 km).")),
    p(bold("Best time: "), t("October to March. Avoid June–August (monsoon). The post-monsoon period (September–October) is beautiful but lodges occasionally stay muddy.")),
    p(bold("What to book in advance: "), t("Good estate stays fill up months ahead, especially for weekends and long weekends. Book your accommodation first, before anything else.")),
    h2("What Made It Special"),
    p(t("Coorg is not about things to do. The Namdroling Monastery at Bylakuppe is genuinely stunning — it is the largest Tibetan settlement outside Tibet, and the golden temple complex is worth an afternoon. Talakaveri, the source of the Kaveri River, matters if either of you is religious. But neither of these is why you go to Coorg.")),
    p(t("You go because there is a verandah, and the coffee estate falls away below it, and in the evening the mist comes up from the valley and makes the world soft-edged and quiet, and there is very little else you need to do.")),
    blockquote("The best honeymoon destination is the one where you forget to take photographs for a few hours. Coorg managed that by day two."),
  ),

  rajasthan_food: doc(
    p(italic("People go to Rajasthan for the forts, the palaces, and the camels. They stay, at least partly, for the food.")),
    h2("Why Rajasthani Cuisine Is Distinctive"),
    p(t("Rajasthan is mostly desert, and its cooking developed to match. Fresh vegetables were historically scarce, water was precious, and the hot dry climate demanded food that could preserve well. The result is a cuisine built around dried beans and lentils, dairy, game meats, and a fearless relationship with fat.")),
    p(t("The spicing is assertive — Rajasthan grows some of India's finest dried red chilies, especially the "), bold("Mathania chili "), t("from Jodhpur, which has a distinctive flavour and moderate heat. The dairy culture produces extraordinarily rich ghee and cultured buttermilk ("), bold("chhaas"), t(") that appears in some form at almost every meal.")),
    h2("Jaipur: Where to Start"),
    p(t("If you are entering Rajasthan through Jaipur, begin at LMB (Laxmi Misthan Bhandar) on Johari Bazaar. It is a sweet shop and restaurant that has been operating since 1727. The "), bold("dal baati churma "), t("here is the standard against which everything else in the state should be measured: three hard wheat rolls (baati) baked over a cow dung fire, broken and drowned in ghee, served with five-spice dal and a sweet crumbled wheat dessert (churma). This is Rajasthan on a plate.")),
    h2("Jodhpur: The Blue City and Its Food"),
    p(t("Jodhpur's signature dish is "), bold("mirchi bada "), t("— a fat green chili stuffed with spiced potato, dipped in chickpea batter, and deep fried. It is sold at street stalls near the Clock Tower market from about 7am, costs ₹15–20 per piece, and is one of the best street foods in India.")),
    p(t("For a full meal, find a dhaba serving "), bold("laal maas"), t(". This is the traditional Rajasthani red meat curry — historically made with wild boar or deer, now most commonly mutton — cooked in a base of Mathania chili and yoghurt. The colour is extraordinary: a deep terracotta that signals genuine heat. Order it only at restaurants with a fast turnover, and ideally at dinner when the chef has had the whole afternoon to build the curry.")),
    h2("Udaipur and the Lake Palace"),
    p(t("Udaipur has the most sophisticated restaurant scene in the state, partly because of the steady traffic of international visitors, and partly because the city's own upper-class food culture is well developed. The rooftop restaurants around the lake serve passable tourist food, but seek out "), bold("Natraj Dining Hall "), t("on Bapu Bazaar — a no-frills Rajasthani thali house that has been serving the same meal for forty years.")),
    h2("15 Dishes You Must Try"),
    ol(
      "Dal Baati Churma — the holy trinity",
      "Laal Maas — mutton in Mathania chili",
      "Ker Sangri — dried desert bean and berry curry",
      "Gatte ki Sabzi — chickpea flour dumplings in yoghurt gravy",
      "Bajra Roti — millet flatbread with a distinctly nutty flavour",
      "Mirchi Bada (Jodhpur) — stuffed chili fritters",
      "Kachori (Jaipur) — fried pastry stuffed with spiced lentils",
      "Mawa Kachori (Jodhpur) — sweet version, filled with thickened milk and nuts",
      "Pyaaz Kachori — onion-stuffed pastry, best at Rawat Mishthan Bhandar",
      "Ghevar — disc-shaped ghee cake soaked in sugar syrup (seasonal: Teej festival)",
      "Rabri — thickened sweetened milk served cold",
      "Lassi (Jaipur) — thick, served in terracotta cups at Lassiwala on MI Road",
      "Makhan Bada — sweet deep-fried milk solid balls",
      "Thadai — spiced cold milk with dry fruits",
      "Shahi Tukda — fried bread in condensed milk and rose water",
    ),
    blockquote("The best meal I had in Rajasthan was a ₹120 dal baati at a roadside stall outside Pushkar at noon. No tablecloth, no menu, no view. Just the food, the heat, and the flies, which meant the food was good."),
  ),

  thailand_first_trip: doc(
    p(italic("Thailand is the easiest first international trip from India for a reason. Here is what nobody told us before we went.")),
    h2("Why Thailand Works as a First International Trip"),
    p(t("The combination that makes Thailand so forgiving for first-time international travellers: visa on arrival (or e-visa) for Indian passport holders, direct flights from most major Indian cities, almost universal acceptance of the fact that you are a tourist and therefore may need directions, English menus in every restaurant that expects tourists, and a cost structure that makes even a modest budget feel substantial.")),
    p(t("We planned our trip in three weeks — booked flights, sorted e-visa, found accommodation through a combination of booking.com and direct hotel bookings in Chiang Mai. Nothing about the logistics was difficult.")),
    h2("Bangkok: Two Days Is Enough"),
    p(t("Bangkok is overwhelming on the first day. The traffic is genuinely impressive (budget 45 minutes for a 3 km journey in peak hours), the heat is intense, and the city is enormous. But two focused days cover the essentials well.")),
    p(bold("Day 1: "), t("Grand Palace complex in the morning (arrive by 8am before the tour groups), lunch at a riverside restaurant, Wat Pho in the afternoon (home to the reclining Buddha and the best traditional Thai massage school in the country), and street food on Khao San Road in the evening.")),
    p(bold("Day 2: "), t("Chatuchak Weekend Market if visiting on a weekend (8,000 stalls, 30 hectares, genuinely extraordinary), or Jim Thompson House on a weekday. Take the BTS Skytrain everywhere — it costs ₹30–50 per journey and Bangkok traffic makes tuk-tuks a romantic but impractical choice.")),
    h2("Chiang Mai: The Part Everyone Loves"),
    p(t("Chiang Mai in northern Thailand is a completely different city from Bangkok: cooler, slower, surrounded by jungle-covered mountains, and built around a moated old town of 300 Buddhist temples. It is where most travellers discover they actually prefer Thailand to what they imagined before they arrived.")),
    ul(
      "Doi Inthanon National Park — Thailand's highest peak, two royal pagodas, morning mist",
      "Sunday Walking Street on Wualai Road — the best night market in the country",
      "Cooking class (₹1,200–₹1,800 including market visit) — universally excellent",
      "Wat Phra Singh — the most revered temple in Chiang Mai, compound dating to 1345",
    ),
    h2("Practical Numbers (For Indian Travellers)"),
    ul(
      "e-Visa: ₹2,500 (applied online, 15 working days)",
      "Direct flights Delhi–Bangkok return: ₹18,000–₹28,000 (book 6–8 weeks ahead)",
      "Guesthouse in Chiang Mai old town: ₹900–₹1,800/night",
      "Street food meal: ₹150–₹250",
      "BTS Skytrain journey: ₹30–₹50",
      "Muay Thai class: ₹700",
    ),
    h2("What We Got Wrong"),
    p(bold("We over-planned. "), t("Thailand rewards improvisation. We had every day blocked out in a spreadsheet and spent the first three days following the spreadsheet even when better things presented themselves. The best parts of the trip — a cooking lesson with a chef who had been making pad thai since before we were born, an afternoon floating on a wooden platform in the Mae Ping River, a village market we found because we turned down a random lane — none of these were on the spreadsheet.")),
    blockquote("Thailand is forgiving of all kinds of tourist mistakes. The food, the people, and the infrastructure absorb your errors and give you something good anyway. It is the ideal country to practise being a traveller in."),
  ),

  // Short draft post
  ladakh_draft: doc(
    h2("The Road to Leh"),
    p(t("The Manali–Leh Highway opens in May, when army engineers finish clearing the snow from Baralacha La (4,890 m) and Tanglang La (5,328 m). By June, civilian traffic follows. The journey takes two days by road — most people stop at Jispa or Sarchu — and covers some of the most extreme terrain on the planet.")),
    p(t("Acclimatisation is non-negotiable. Fly to Leh and rest for two full days before doing anything more strenuous than a gentle walk. Drive in and you have the gradual ascent working in your favour — but even then, the altitude of Leh (3,524 m) will make itself known.")),
    h2("Pangong Lake"),
    p(t("The drive from Leh to Pangong Tso takes about five hours over Chang La (5,360 m), the third highest motorable pass in the world. The lake itself sits at 4,350 metres and stretches 134 kilometres east into Tibet — only about a third of it falls within India.")),
    p(t("Stay overnight at one of the camps on the south shore. At dawn, before the tourist jeeps arrive, the lake is silent except for the occasional migrating bar-headed goose, and the colours shift from deep indigo to a pale aquamarine as the sun comes over the mountains.")),
  ),

  // Short pending-review post
  uttarakhand_chardham: doc(
    p(italic("My grandmother did the Char Dham on foot in 1978. It took her six months. We did it by helicopter in three days. I am still deciding how I feel about that.")),
    h2("The Four Dhams"),
    p(t("Yamunotri, Gangotri, Kedarnath, and Badrinath — the four sacred sites that form the Char Dham circuit sit between 3,150 and 3,888 metres in the Uttarakhand Himalayas, and together they represent the most important Hindu pilgrimage in India. The route draws three to four million pilgrims between May (when the shrines open after winter) and October (when they close before the snow).")),
    h2("By Road vs By Helicopter"),
    p(t("The traditional pilgrimage by road and foot takes 10–12 days and requires reasonable physical fitness — the trek to Kedarnath alone is 16 kilometres at altitude. Helicopter services from Dehradun, Phata, and Sirsi now make it possible to complete the circuit in 3–4 days, which has both democratised the pilgrimage for older and less mobile pilgrims and dramatically increased the pressure on all four sites.")),
    p(t("My family, ranging in age from 14 to 74, chose the helicopter option for the older members and the road-and-trek option for the younger ones. We reconverged at Badrinath.")),
    h2("Kedarnath"),
    p(t("The Kedarnath temple is the centrepiece of the circuit. The stone structure dates to the 8th century and survived the catastrophic 2013 floods — which killed nearly 6,000 people in the valley — largely intact, though the town around it was destroyed. The rebuilt town is newer and starker than before, but the temple itself carries the weight of twelve centuries of devotion in its stones.")),
    p(t("The trek up from Gaurikund (the trailhead, accessible by road) is strenuous but beautiful — especially in June when the rhododendrons are still in bloom at the higher elevations. Pony and palanquin services are available for those who need them.")),
    blockquote("Whether you are devout or simply curious about what draws millions of people to these particular mountains every year, the Char Dham answers something. I am not sure I can explain what, precisely. Perhaps that is the point."),
  ),
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding blog data…\n");

  // ── 1. Blog categories ────────────────────────────────────────────────────

  const categoryDefs = [
    { name: "Adventure",         color: "#EF4444" },
    { name: "Beach & Islands",   color: "#0EA5E9" },
    { name: "Budget Travel",     color: "#10B981" },
    { name: "Honeymoon",         color: "#EC4899" },
    { name: "Culture & History", color: "#8B5CF6" },
    { name: "Food & Travel",     color: "#F59E0B" },
    { name: "Solo Travel",       color: "#6366F1" },
    { name: "Family Travel",     color: "#14B8A6" },
  ];

  const categories: Record<string, number> = {};
  for (const cat of categoryDefs) {
    const record = await db.blog_categories.upsert({
      where:  { slug: slug(cat.name) },
      update: { name: cat.name, is_active: true },
      create: { name: cat.name, slug: slug(cat.name), is_active: true, sort_order: categoryDefs.indexOf(cat) },
    });
    categories[cat.name] = record.id;
    console.log(`   ✓ Category: ${cat.name}`);
  }

  // ── 2. Blog tags ──────────────────────────────────────────────────────────

  const tagNames = [
    "kashmir", "himachal", "kerala", "goa", "rajasthan",
    "spiti", "ladakh", "coorg", "uttarakhand", "thailand",
    "mountains", "beaches", "heritage", "pilgrimage", "nature",
    "budget", "luxury", "solo", "couple", "family",
    "trekking", "photography", "food", "offbeat", "monsoon",
  ];

  const tags: Record<string, number> = {};
  for (const name of tagNames) {
    const record = await db.blog_tags.upsert({
      where:  { slug: name },
      update: {},
      create: { name, slug: name },
    });
    tags[name] = record.id;
  }
  console.log(`   ✓ Tags: ${tagNames.length} upserted`);

  // ── 3. Seed author ────────────────────────────────────────────────────────

  const author = await db.user.upsert({
    where:  { email: "stories@dreamsyatri.com" },
    update: {},
    create: {
      email:  "stories@dreamsyatri.com",
      name:   "DreamsYatri Editorial",
      image:  "https://ui-avatars.com/api/?name=DY&background=EF4444&color=fff&size=128",
      status: "ACTIVE",
      role:   "USER",
    },
  });
  console.log(`   ✓ Seed author: ${author.name}`);

  // ── 4. Helper to (re)create a post ────────────────────────────────────────

  async function upsertPost(def: {
    slug_:    string;
    title:    string;
    excerpt:  string;
    cover:    string;
    content:  object;
    status:   "PUBLISHED" | "PENDING_REVIEW" | "DRAFT";
    readTime: number;
    catName:  string;
    tagKeys:  string[];
    pubDate?: Date;
  }) {
    // Delete existing so re-seeding stays clean
    await db.blog_posts.deleteMany({ where: { slug: def.slug_ } });

    const post = await db.blog_posts.create({
      data: {
        slug:         def.slug_,
        title:        def.title,
        excerpt:      def.excerpt,
        content:      def.content as any,
        cover_image:  def.cover,
        status:       def.status,
        read_time:    def.readTime,
        author_id:    author.id,
        published_at: def.status === "PUBLISHED" ? (def.pubDate ?? new Date()) : null,
        categories: {
          create: [{ category_id: categories[def.catName] }],
        },
        tags: {
          create: def.tagKeys
            .filter((k) => tags[k] !== undefined)
            .map((k) => ({ tag_id: tags[k] })),
        },
      },
    });

    const statusIcon = def.status === "PUBLISHED" ? "🟢" : def.status === "PENDING_REVIEW" ? "🟡" : "⚪";
    console.log(`   ${statusIcon} Post [${def.status}]: ${def.title}`);
    return post;
  }

  // ── 5. Blog posts ─────────────────────────────────────────────────────────

  console.log("\n   Creating blog posts…");

  await upsertPost({
    slug_:    "why-kashmir-is-called-paradise-on-earth",
    title:    "Why Kashmir Is Called Paradise on Earth: A First-Time Visitor's Account",
    excerpt:  "After three trips I still struggle to put Kashmir into words. The valley, the houseboats on Dal Lake, the saffron fields of Pampore — here is my attempt.",
    cover:    "https://images.unsplash.com/photo-1614591276564-7b3e69347a48?w=1200&auto=format&fit=crop",
    content:  CONTENTS.kashmir,
    status:   "PUBLISHED",
    readTime: 7,
    catName:  "Culture & History",
    tagKeys:  ["kashmir", "mountains", "nature", "photography", "couple"],
    pubDate:  new Date("2026-03-15"),
  });

  await upsertPost({
    slug_:    "spiti-valley-beginners-guide-cold-desert",
    title:    "Spiti Valley: A Complete Beginner's Guide to the Cold Desert",
    excerpt:  "A thousand metres above the treeline, where tarmac turns to gravel and the air tastes like cold stone, you enter a different world. Here is everything you need to know.",
    cover:    "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&auto=format&fit=crop",
    content:  CONTENTS.spiti,
    status:   "PUBLISHED",
    readTime: 9,
    catName:  "Adventure",
    tagKeys:  ["spiti", "himachal", "mountains", "trekking", "offbeat", "solo", "photography"],
    pubDate:  new Date("2026-03-22"),
  });

  await upsertPost({
    slug_:    "kerala-backwaters-complete-guide",
    title:    "Kerala Backwaters: Everything You Need to Know Before Visiting",
    excerpt:  "Kerala moves at the pace of the backwater — slow, deliberate, and utterly unhurried. From houseboats to spice gardens, here is the complete guide.",
    cover:    "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&auto=format&fit=crop",
    content:  CONTENTS.kerala,
    status:   "PUBLISHED",
    readTime: 8,
    catName:  "Beach & Islands",
    tagKeys:  ["kerala", "beaches", "nature", "food", "family", "couple"],
    pubDate:  new Date("2026-04-01"),
  });

  await upsertPost({
    slug_:    "goa-on-a-budget-under-5000",
    title:    "Goa on a Budget: How to Have the Time of Your Life for Under ₹5,000",
    excerpt:  "The internet will tell you Goa is expensive. The internet is wrong — or at least it is talking about a very specific version of Goa you are not obliged to visit.",
    cover:    "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&auto=format&fit=crop",
    content:  CONTENTS.goa_budget,
    status:   "PUBLISHED",
    readTime: 7,
    catName:  "Budget Travel",
    tagKeys:  ["goa", "beaches", "budget", "solo", "food"],
    pubDate:  new Date("2026-04-10"),
  });

  await upsertPost({
    slug_:    "honeymoon-in-coorg-personal-experience",
    title:    "The Perfect Honeymoon in Coorg: Our Personal Experience",
    excerpt:  "We almost picked Shimla. I am glad we did not. Coorg gave us misty mornings, coffee estate walks, and absolute silence. Here is why it works.",
    cover:    "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=1200&auto=format&fit=crop",
    content:  CONTENTS.honeymoon_coorg,
    status:   "PUBLISHED",
    readTime: 7,
    catName:  "Honeymoon",
    tagKeys:  ["coorg", "nature", "couple", "mountains", "photography"],
    pubDate:  new Date("2026-04-18"),
  });

  await upsertPost({
    slug_:    "rajasthan-street-food-trail-15-dishes",
    title:    "Street Food Trail: 15 Dishes You Must Try in Rajasthan",
    excerpt:  "People go to Rajasthan for the forts and palaces. They stay, at least partly, for the food. A guide to eating your way across the desert state.",
    cover:    "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&auto=format&fit=crop",
    content:  CONTENTS.rajasthan_food,
    status:   "PUBLISHED",
    readTime: 8,
    catName:  "Food & Travel",
    tagKeys:  ["rajasthan", "heritage", "food", "culture", "budget", "family"],
    pubDate:  new Date("2026-04-25"),
  });

  // Pending review
  await upsertPost({
    slug_:    "uttarakhand-char-dham-yatra-spiritual-journey",
    title:    "Uttarakhand Char Dham Yatra: A Spiritual Journey Through the Himalayas",
    excerpt:  "My grandmother did the Char Dham on foot in 1978. It took her six months. We did it by helicopter in three days. I am still deciding how I feel about that.",
    cover:    "https://images.unsplash.com/photo-1502786129293-79981df4e689?w=1200&auto=format&fit=crop",
    content:  CONTENTS.uttarakhand_chardham,
    status:   "PENDING_REVIEW",
    readTime: 6,
    catName:  "Culture & History",
    tagKeys:  ["uttarakhand", "mountains", "pilgrimage", "heritage", "family"],
  });

  // Draft
  await upsertPost({
    slug_:    "planning-first-international-trip-thailand",
    title:    "Planning Your First International Trip: Why Thailand Is the Answer",
    excerpt:  "Thailand is the easiest first international trip from India for a reason. Here is what nobody told us before we went — the things that actually matter.",
    cover:    "https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&auto=format&fit=crop",
    content:  CONTENTS.thailand_first_trip,
    status:   "DRAFT",
    readTime: 8,
    catName:  "Budget Travel",
    tagKeys:  ["thailand", "budget", "solo", "offbeat", "food"],
  });

  // Ladakh draft (no cover — tests the no-image fallback UI)
  await upsertPost({
    slug_:    "road-to-leh-manali-leh-highway-guide",
    title:    "The Road to Leh: Manali–Leh Highway Guide",
    excerpt:  "Notes from the highest motorable road in the world: what to expect, what to pack, and why the journey matters as much as the destination.",
    cover:    "",
    content:  CONTENTS.ladakh_draft,
    status:   "DRAFT",
    readTime: 5,
    catName:  "Adventure",
    tagKeys:  ["ladakh", "mountains", "trekking", "photography", "solo"],
  });

  console.log(`
✅  Blog seed complete!

   Categories : ${categoryDefs.length}
   Tags       : ${tagNames.length}
   Posts      : 6 published · 1 pending · 2 draft

   Public listing : /blogs
   Detail example : /blogs/why-kashmir-is-called-paradise-on-earth
   Admin queue    : /dashboard/blogs
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); });
