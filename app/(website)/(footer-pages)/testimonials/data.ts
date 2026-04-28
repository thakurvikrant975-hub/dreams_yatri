// ── Data ──────────────────────────────────────────────────────────────────────
export const DESTINATIONS = ["All", "Kashmir", "Himachal Pradesh", "Rajasthan", "Goa", "Dubai", "Thailand", "Uttarakhand"];

export const FEATURED = {
  name: "Priya & Rohit Sharma",
  location: "Mumbai",
  destination: "Kashmir",
  avatar: "PR",
  rating: 5,
  date: "March 2025",
  image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&auto=format",
  quote: "We'd been planning our Kashmir trip for three years. Every time, logistics killed it — hotels, cabs, permits, the uncertainty of it all. Dreams Yatri handed us an itinerary so airtight that the only thing we had to think about was which lens to use.",
  highlight: "We just… showed up and fell in love with Kashmir.",
  trip: "7N/8D Kashmir Grand Tour",
};

export const TESTIMONIALS = [
  {
    id: 1, name: "Amit Verma", location: "Delhi", destination: "Himachal Pradesh",
    avatar: "AV", rating: 5, date: "Feb 2025",
    quote: "Booked a family trip to Manali with my parents (aged 65+). I was nervous about altitude and mobility. The team customised the entire itinerary around their pace — no rushing, no panic. My father said it was the best holiday of his life.",
    trip: "6N/7D Manali Family Package",
  },
  {
    id: 2, name: "Sneha Kulkarni", location: "Pune", destination: "Goa",
    avatar: "SK", rating: 5, date: "Jan 2025",
    quote: "Planned a bachelorette trip for 8 girls and I was terrified something would go wrong. Nothing did. Villas, transfers, beach shacks — all sorted. Dreams Yatri turned a logistical nightmare into the most fun week of our lives.",
    trip: "5N/6D Goa Girls Trip",
  },
  {
    id: 3, name: "Karan & Deepika Mehta", location: "Bangalore", destination: "Dubai",
    avatar: "KD", rating: 5, date: "Dec 2024",
    quote: "First international trip together. The visa guidance alone was worth it — zero stress. Desert safari, Burj Khalifa, the souks — perfectly paced. We never felt like tourists on a schedule.",
    trip: "5N/6D Dubai Honeymoon",
  },
  {
    id: 4, name: "Rajesh Nair", location: "Chennai", destination: "Rajasthan",
    avatar: "RN", rating: 5, date: "Nov 2024",
    quote: "I'm the kind of traveller who reads every review obsessively before booking. I spent exactly 20 minutes with Dreams Yatri, shared my wish list, and got back an itinerary I couldn't have built myself in a week.",
    trip: "9N/10D Rajasthan Royal Circuit",
  },
  {
    id: 5, name: "Meera Iyer", location: "Hyderabad", destination: "Thailand",
    avatar: "MI", rating: 5, date: "Oct 2024",
    quote: "Solo female traveller going to Bangkok and Phuket for the first time. The team checked in every day. I never once felt alone or unsafe. Ended up extending by 2 days because I didn't want to leave.",
    trip: "6N/7D Thailand Solo",
  },
  {
    id: 6, name: "The Agarwal Family", location: "Jaipur", destination: "Uttarakhand",
    avatar: "AG", rating: 5, date: "Sep 2024",
    quote: "Rishikesh with three kids under 10 — everyone said we were mad. Dreams Yatri made it feel like the most natural thing in the world. Rafting, yoga, the Ganga aarti. Kids still talk about it.",
    trip: "4N/5D Rishikesh Family Adventure",
  },
  {
    id: 7, name: "Vikram Singh", location: "Chandigarh", destination: "Himachal Pradesh",
    avatar: "VS", rating: 5, date: "Aug 2024",
    quote: "Spiti Valley road trip — the one every biker dreams of. The route, permits, accommodation at high altitude camps, backup support — everything was handled. The mountains were ours.",
    trip: "10N/11D Spiti Valley Bike Trip",
  },
  {
    id: 8, name: "Ananya & Siddharth", location: "Kolkata", destination: "Kashmir",
    avatar: "AS", rating: 5, date: "Jul 2024",
    quote: "We asked for a honeymoon with houseboats, tulip gardens, and a proper snow experience. We got all three, plus a shikara ride at sunrise that I genuinely will remember for the rest of my life.",
    trip: "7N/8D Kashmir Honeymoon",
  },
  {
    id: 9, name: "Dr. Pradeep Gupta", location: "Lucknow", destination: "Rajasthan",
    avatar: "PG", rating: 5, date: "Jun 2024",
    quote: "Took a heritage circuit with my mother — Udaipur, Jodhpur, Jaisalmer. Every hotel was a palace or haveli, every transfer was smooth. A trip worthy of the destination.",
    trip: "8N/9D Rajasthan Heritage Tour",
  },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
export const AVATAR_COLORS = [
  ["#FEE2E2", "#DC2626"], ["#FEF3C7", "#D97706"], ["#E0F2FE", "#0284C7"],
  ["#D1FAE5", "#059669"], ["#EDE9FE", "#7C3AED"], ["#FCE7F3", "#DB2777"],
  ["#F3F4F6", "#374151"], ["#FFF7ED", "#EA580C"], ["#F0FDF4", "#16A34A"],
];

export const FEATURED_ITEMS: FeaturedTestimonial[] = [
  {
    name:        "Priya & Rohit Sharma",
    avatar:      "PR",
    location:    "Mumbai",
    destination: "Kashmir",
    rating:      5,
    date:        "March 2025",
    image:       "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=600&fit=crop&auto=format",
    quote:       "We'd been planning our Kashmir trip for three years. Every time, logistics killed it — hotels, cabs, permits, the uncertainty of it all. Dreams Yatri handed us an itinerary so airtight that the only thing we had to think about was which lens to use.",
    highlight:   "We just… showed up and fell in love with Kashmir.",
    trip:        "7N/8D Kashmir Grand Tour",
    bgAccent:    "#0EA5E9",
  },
  {
    name:        "Karan & Deepika Mehta",
    avatar:      "KD",
    location:    "Bangalore",
    destination: "Dubai",
    rating:      5,
    date:        "December 2024",
    image:       "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=900&h=600&fit=crop&auto=format",
    quote:       "First international trip together. The visa guidance alone was worth it — zero stress. Desert safari, Burj Khalifa, the souks — perfectly paced. We never felt like tourists on a schedule.",
    highlight:   "The most seamless international trip we could have asked for.",
    trip:        "5N/6D Dubai Honeymoon",
    bgAccent:    "#F97316",
  },
  {
    name:        "Meera Iyer",
    avatar:      "MI",
    location:    "Hyderabad",
    destination: "Thailand",
    rating:      5,
    date:        "October 2024",
    image:       "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=900&h=600&fit=crop&auto=format",
    quote:       "Solo female traveller going to Bangkok and Phuket for the first time. The team checked in every day. I never once felt alone or unsafe. Ended up extending by 2 days because I didn't want to leave.",
    highlight:   "I felt taken care of every single day.",
    trip:        "6N/7D Thailand Solo",
    bgAccent:    "#10B981",
  },
  {
    name:        "The Agarwal Family",
    avatar:      "AG",
    location:    "Jaipur",
    destination: "Rajasthan",
    rating:      5,
    date:        "November 2024",
    image:       "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&h=600&fit=crop&auto=format",
    quote:       "We did the full Rajasthan royal circuit — Udaipur, Jodhpur, Jaisalmer. Every hotel was a heritage haveli, every transfer was smooth. A trip that actually matched its photographs.",
    highlight:   "Rajasthan the way it was always meant to be experienced.",
    trip:        "9N/10D Rajasthan Heritage Tour",
    bgAccent:    "#F59E0B",
  },
];