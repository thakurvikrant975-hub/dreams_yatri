// Builds the copy-pasteable ChatGPT prompt for the "Generate with AI" panel
// in LandingPageEditorClient. Kept as a plain string template (not a server
// action) since it never touches the DB — it's just text assembled in the
// browser before being copied to the clipboard.
//
// The field limits quoted here are deliberately TIGHTER than the hard caps
// enforced by `landingPageSchema` in actions.ts (e.g. schema allows a 320
// char seoDescription, but we ask the AI for ~155 so it doesn't get
// truncated in Google search results). applyAiJson() in
// LandingPageEditorClient.tsx still clamps to the hard schema max as a
// safety net in case the AI ignores the instructions.
export function buildAiPrompt(topic: string): string {
  return `You are an expert SEO copywriter for DreamsYatri, an Indian travel agency that sells curated holiday packages (family trips, honeymoons, adventure tours) with real human travel-expert support over phone and WhatsApp.

Write landing-page content for a Google Ads campaign targeting: "${topic}".

Return ONLY a single valid JSON object — no markdown code fences, no commentary before or after — matching EXACTLY this shape and these limits:

{
  "title": string,            // 40-70 characters. Internal/admin-facing page title.
  "seoTitle": string,         // Max 60 characters. Primary keyword + destination, shown in Google search results and the browser tab.
  "description": string,      // 120-220 characters. Warm, benefit-driven intro shown in the page hero, under the headline.
  "seoDescription": string,   // 150-160 characters. Compelling meta description with a soft call-to-action, shown under the title in Google search results.
  "heroEyebrow": string,      // Max 40 characters. Small label above the big headline, e.g. "Spiti Valley · Honeymoon Special".
  "heroHeadline": string,     // Max 30 characters, 2-4 words. Big bold hero title — it renders in a huge uppercase font, so keep it very short and punchy.
  "destination": string,      // The destination name shown to leads, e.g. "Spiti Valley".
  "faqs": [                   // Exactly 5 items.
    { "question": string, "answer": string }
    // question <= 100 characters.
    // answer: 30-60 words, factual and reassuring — real logistics (best season, inclusions, how to reach, customisation, cancellation), not generic filler.
  ],
  "testimonials": [           // Exactly 3 items.
    { "authorName": string, "authorRole": string, "quote": string, "rating": number }
    // authorName: a realistic Indian first + last name.
    // authorRole: trip type + city, e.g. "Honeymoon, Bengaluru".
    // quote: 25-40 words, first-person, specific and credible (mention a real detail from the trip) — no generic praise.
    // rating: integer, 4 or 5.
  ],
  "items": [                  // Exactly 4 package card ideas.
    {
      "title": string,        // Max 60 characters, e.g. "Spiti Valley Complete Circuit".
      "description": string,  // 20-30 words: what's included / the core experience.
      "rating": number,       // A realistic star rating between 4.3 and 5.0, one decimal place, e.g. 4.7. Vary it slightly across the 4 items — don't repeat the same value.
      "routeLabel": string,   // Either a duration like "6D/5N" OR a short route/circuit name, max 30 characters.
      "priceLabel": string,   // A realistic *starting-from* INR price for this kind of trip in the Indian travel market, formatted like "₹16,999/person". A plausible estimate, not a guarantee.
      "badgeLabel": string    // Max 20 characters, e.g. "Best Seller", "Most Popular", "Editor's Pick" — vary these across the 4 items; one item may use "".
    }
  ]
}

Tone: warm, trustworthy, and specific to the destination — mention real, well-known local highlights and places by name. Never generic filler or "Lorem ipsum"-style placeholder text. Do not write in ALL CAPS (the page design applies that itself). Do not invent statistics, certifications, awards, or guarantees you can't back up — the "starting from" prices and star ratings are the only figures you should estimate, and they should be realistic for India.

This will be reviewed by a human before publishing, but write it as production-ready as possible.`;
}
