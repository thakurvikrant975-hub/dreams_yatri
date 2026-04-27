import { CalendarCheck, Car, CheckCircle2, Clock, Compass, Globe, Headphones, HeartHandshake, Hotel, Mountain, PhoneCall, Plane, ShieldCheck, Sparkles, Star, TrendingUp, Users, Wallet, Map } from "lucide-react";


export const gallery = [
  { id: 1, src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80", label: "Swiss Alps", tag: "Europe" },
  { id: 2, src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", label: "Bali Temples", tag: "Asia" },
  { id: 3, src: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80", label: "Taj Mahal", tag: "India" },
  { id: 4, src: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600&q=80", label: "Santorini", tag: "Greece" },
  { id: 5, src: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80", label: "Paris Streets", tag: "Europe" },
  { id: 6, src: "https://images.unsplash.com/photo-1501179691627-eeaa65ea017c?w=600&q=80", label: "Maldives", tag: "Ocean" },
  { id: 7, src: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&q=80", label: "Desert Safari", tag: "Middle East" },
  { id: 8, src: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&q=80", label: "Ladakh Roads", tag: "India" },
];

export const services = [
  { Icon: Hotel, title: "Hotel Booking", desc: "Handpicked, confirmed accommodations locked in before you pack — boutique stays to luxury resorts.", color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
  { Icon: Car, title: "Cab & Transfers", desc: "Airport pickups, city rides, outstation transfers. Driver details shared 24 hrs in advance. Always on time.", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
  { Icon: Compass, title: "Activity Booking", desc: "Paragliding, safaris, city walks, food tours — every adventure curated and pre-booked for your vibe.", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100" },
  { Icon: CalendarCheck, title: "Itinerary Planning", desc: "Share your dates and preferences. We send back a complete day-by-day plan — no research required.", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100" },
  { Icon: Headphones, title: "24/7 Support", desc: "Missed a flight? Hotel confusion? WhatsApp us at 2 AM. A real human responds in minutes.", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100" },
  { Icon: Wallet, title: "Best Price Promise", desc: "We negotiate rates you can't find online. Same quality, smarter price. No hidden fees, ever.", color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100" },
];

export const timelineData = [
  { year: "2018", title: "The Nightmare Trip", Icon: Mountain, desc: "Our founder landed in Manali at midnight — hotel unconfirmed, cab ghosted, phone at 3%. He stood in the cold in a strange city and thought: someone needs to fix this." },
  { year: "2019", title: "The Mission Takes Shape", Icon: Sparkles, desc: "After one too many panicked texts asking 'what do I do now?', the vision crystallised: build a travel service that removes every ounce of logistics anxiety." },
  { year: "2020", title: "Roamly is Born", Icon: Plane, desc: "Built from a laptop, fuelled by chai and conviction. One product, one promise — you travel, we handle every detail." },
  { year: "2021", title: "First 5,000 Travelers", Icon: Users, desc: "Word spread fast. Solo backpackers, honeymooners, families — all coming back with one thing in common: zero horror stories." },
  { year: "2022", title: "50,000 Happy Journeys", Icon: Globe, desc: "From Ladakh to Lombok, Rajasthan to Rome. 50,000 trips managed. A 98% hassle-free record that we're obsessively proud of." },
  { year: "2024", title: "200+ Destinations & Growing", Icon: TrendingUp, desc: "A team of 80 travel obsessives, 200+ destinations, and one singular obsession — making every trip feel effortless." },
];

export const values = [
  { Icon: HeartHandshake, title: "Born from Real Pain", desc: "We didn't build this in a boardroom. We built it because we lived the chaos — unconfirmed hotels, missing cabs, and panicked midnight calls in unfamiliar cities.", color: "text-red-500", bg: "bg-red-50" },
  { Icon: ShieldCheck, title: "No Surprises, Ever", desc: "Full transparency on pricing, confirmations, and plans. What we promise, we deliver — every single time, without exception.", color: "text-emerald-500", bg: "bg-emerald-50" },
  { Icon: Star, title: "Travelers First", desc: "Every feature, every process, every decision starts with one question: does this make the traveler's experience better?", color: "text-amber-500", bg: "bg-amber-50" },
  { Icon: PhoneCall, title: "Real Humans, Always", desc: "No chatbots. No automated hold music. When you reach out, a real person who genuinely loves travel picks up.", color: "text-blue-500", bg: "bg-blue-50" },
];

export const stats = [
  { number: "50K+", label: "Happy Travelers", Icon: Users },
  { number: "200+", label: "Destinations", Icon: Globe },
  { number: "98%", label: "Hassle-Free Rate", Icon: CheckCircle2 },
  { number: "24/7", label: "Expert Support", Icon: Clock },
];

export const testimonials = [
  { name: "Priya S.", route: "Mumbai → Bali", text: "I literally just showed up at the airport. Hotel, cab, day trips — everything was already sorted. This is what travel should feel like.", initials: "PS" },
  { name: "Rahul M.", route: "Delhi → Manali", text: "The cab was waiting at the bus stand, the hotel was warm and confirmed. I've had so many bad trips before — this felt like a completely different world.", initials: "RM" },
  { name: "Ananya K.", route: "Bangalore → Rajasthan", text: "Eight of us with chaotic schedules. Roamly coordinated hotels, activities, and cabs for every single person. Zero drama. Just pure Rajasthan magic.", initials: "AK" },
];

export const team = [
  { name: "Arjun Mehta", role: "Founder & Chief Explorer", Icon: Mountain, countries: "42 countries" },
  { name: "Simran Kaur", role: "Head of Experiences", Icon: Sparkles, countries: "38 countries" },
  { name: "Dev Patel", role: "Tech & Operations", Icon: Globe, countries: "29 countries" },
  { name: "Neha Sharma", role: "Customer Happiness", Icon: HeartHandshake, countries: "31 countries" },
];


// export const timelineData = [
//   {
//     year: "2021",
//     tag: "The Beginning",
//     title: "Himachal & Goa Launch",
//     desc: "Started with curated trips to Himachal and Goa, serving our first 1,000+ travelers with personalized itineraries.",
//     icon: Mountain,
//     image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
//     imageAlt: "Himachal mountains landscape",
//     stat: { value: "1K+", label: "Travellers" },
//   },
//   {
//     year: "2022",
//     tag: "Rapid Growth",
//     title: "Pan India Expansion",
//     desc: "Expanded to Rajasthan, Kerala, and Northeast India with 5,000+ happy travelers and growing community.",
//     icon: Map,
//     image: "https://images.unsplash.com/photo-1477587458883-47145ed94245",
//     imageAlt: "Kerala backwaters",
//     stat: { value: "5K+", label: "Travellers" },
//   },
//   {
//     year: "2023",
//     tag: "International Launch",
//     title: "Dubai & Thailand",
//     desc: "Entered international markets with premium Dubai and Thailand packages, crossing 10,000+ bookings.",
//     icon: Plane,
//     image: "https://images.unsplash.com/photo-1518684079-3c830dcef090",
//     imageAlt: "Dubai skyline",
//     stat: { value: "10K+", label: "Travellers" },
//   },
//   {
//     year: "2024",
//     tag: "Global Reach",
//     title: "Europe & Bali",
//     desc: "Launched Europe circuits and Bali experiences, offering luxury and budget travel to 20,000+ customers.",
//     icon: Globe,
//     image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34",
//     imageAlt: "Eiffel Tower Paris",
//     stat: { value: "20K+", label: "Travellers" },
//   },
//   {
//     year: "2025",
//     tag: "Community First",
//     title: "Group & Solo Trips",
//     desc: "Built a strong travel community with group departures and solo-friendly trips across 15+ countries.",
//     icon: Users,
//     image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff",
//     imageAlt: "Group of travelers",
//     stat: { value: "35K+", label: "Travellers" },
//   },
//   {
//     year: "2026",
//     tag: "Next Chapter",
//     title: "Custom Travel Platform",
//     desc: "Launched AI-powered itinerary builder and seamless booking platform for personalized global travel.",
//     icon: Compass,
//     image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d",
//     imageAlt: "Travel planning map",
//     stat: { value: "50K+", label: "Travellers" },
//   },
// ];