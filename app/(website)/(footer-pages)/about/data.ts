import { CalendarCheck, Car, CheckCircle2, Clock, Compass, Globe, Headphones, HeartHandshake, Hotel, Mountain, PhoneCall, Plane, ShieldCheck, Sparkles, Star, TrendingUp, Users, Wallet, Map, MapPin, Globe2, Rocket } from "lucide-react";


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
  {
    name: "Vikrant Thakur",
    role: "Founder & Lead Planner",
    photo: "https://media.istockphoto.com/id/1325161510/photo/portrait-of-mature-business-men-wearing-suit-standing-against-gray-background-stock-photo.jpg?s=612x612&w=0&k=20&c=q6w13AEiELAifa_FUOzu1EzC9IIFa56zlNZtcoKefIU=",
    experience: "11 yrs",
    statVal: "480+",
    statKey: "Countries",
    tag: "HP Specialist",
    quote: "Every mountain has a story. I help you find yours.",
  },
  {
    name: "Ravi Kant",
    role: "Operations Manager",
    photo: "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    experience: "8 yrs",
    statVal: "1,200+",
    statKey: "Trips Managed",
    tag: "N. India Expert",
    quote: "Flawless logistics is its own kind of art form.",
  },
  {
    name: "Priya Sharma",
    role: "International Packages Lead",
    photo: "https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?q=80&w=1065&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    experience: "6 yrs",
    statVal: "135+",
    statKey: "Countries",
    tag: "Dubai & Thailand",
    quote: "I find the hidden gems the guidebooks always miss.",
  },
  {
    name: "Arjun Mehta",
    role: "Pilgrimage & Culture Expert",
    photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80",
    experience: "5 yrs",
    statVal: "500+",
    statKey: "Clients Served",
    tag: "Char Dham",
    quote: "Spiritual journeys deserve precision and reverence.",
  },
];
export const timelineData = [
  {
    year: "2023",
    tag: "The Origin",
    title: "A Night in Manali Sparked It All",
    Icon: MapPin,
    desc: "After a long bus ride, Vikrant reached Manali to find no hotel, no cab, and no support at 2 AM. That moment exposed a broken system — and led to the idea of Dreams Yatri: travel without uncertainty.",
    images: [
      {
        src: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&q=75",
        alt: "Manali snow-covered mountains at dusk",
      },
      {
        src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75",
        alt: "Mountain road in Himachal Pradesh",
      },
      {
        src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=75",
        alt: "Cozy mountain hotel interior",
      },
    ],
  },
  {
    year: "2024",
    tag: "Building the Foundation",
    title: "A Team That Knew the Mountains",
    Icon: Users,
    desc: "A team of 10 travel experts mapped Himachal end-to-end, building trusted local networks. 5,000+ travellers explored with us — and none were left stranded.",
    images: [
      {
        src: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&q=75",
        alt: "Dreams Yatri team in Himachal Pradesh",
      },
      {
        src: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=75",
        alt: "Spiti Valley landscape",
      },
      {
        src: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=600&q=75",
        alt: "Dharamshala hills and monasteries",
      },
      {
        src: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1674&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=75",
        alt: "Happy travellers on mountain trail",
      },
    ],
  },
  {
    year: "2025",
    tag: "Going Pan-India",
    title: "Expanding Across India",
    Icon: Globe2,
    desc: "From Kashmir to Kerala, we scaled nationwide and launched international trips. 50,000+ journeys completed with a 4.8★ rating — growth backed by trust.",
    images: [
      {
        src: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=75",
        alt: "Houseboat on Dal Lake Kashmir",
      },
      {
        src: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?q=80&w=2076&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=75",
        alt: "Rajasthan desert safari",
      },
      {
        src: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=75",
        alt: "Goa beaches at golden hour",
      },
    ],
  },
  {
    year: "2026",
    tag: "Going Global",
    title: "Taking Travel Worldwide",
    Icon: Rocket,
    desc: "We’re expanding to Southeast Asia, Europe, and beyond — bringing the same reliable, hassle-free travel experience to global destinations.",
    images: [
      {
        src: "https://plus.unsplash.com/premium_photo-1697729914552-368899dc4757?q=80&w=2012&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=75",
        alt: "International travel destination Dubai",
      },
      {
        src: "https://images.unsplash.com/photo-1486299267070-83823f5448dd?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=75",
        alt: "London cityscape",
      },
      {
        src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=600&q=75",
        alt: "International travel destination",
      },
    ],
  },
];