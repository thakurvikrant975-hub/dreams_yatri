import Link from "next/link";
import Image from "next/image";
import DyLogo from "@/app/components/ui/DyLogo";
// ─── Types ────────────────────────────────────────────────────────────────────

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

interface ContactItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}

interface SocialLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Destinations",
    links: [
      { label: "Himachal Pradesh", href: "/destinations/himachal-pradesh" },
      { label: "Kashmir", href: "/destinations/kashmir" },
      { label: "Rajasthan", href: "/destinations/rajasthan" },
      { label: "Goa", href: "/destinations/goa" },
      { label: "Kerala", href: "/destinations/kerala" },
      { label: "Ladakh", href: "/destinations/ladakh" },
      { label: "Dubai", href: "/destinations/dubai" },
      { label: "Thailand", href: "/destinations/thailand" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Holiday Packages", href: "/services/holiday-packages" },
      { label: "Flight Booking", href: "/services/flight-booking" },
      { label: "Cab & Transport", href: "/services/cab-transport" },
      { label: "Honeymoon Packages", href: "/services/honeymoon-packages" },
      { label: "Adventure Tours", href: "/services/adventure-tours" },
      { label: "Pilgrimage Tours", href: "/services/pilgrimage-tours" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Our Story", href: "/our-story" },
      // { label: "Team", href: "/team" },
      { label: "Careers", href: "/careers" },
      // { label: "Press", href: "/press" },
      { label: "Blogs", href: "/blogs" },
      // { label: "Partners", href: "/partners" },
      { label: "Testimonials", href: "/testimonials" },
      { label: "Write for us", href: "/write-for-us" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Contact Us", href: "/contact" },
      { label: "FAQs", href: "/faqs" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Cancellation Policy", href: "/cancellation-policy" },
      // { label: "Payment Options", href: "/payment-options" },
      { label: "Travel Insurance", href: "/travel-insurance" },
      { label: "Customer Support", href: "/support" },
    ],
  },
];

const CONTACT_ITEMS: ContactItem[] = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
      </svg>
    ),
    label: "24 × 7 HELPLINE",
    value: "+91 7807727100",
    href: "tel:+917807727100",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    label: "EMAIL US",
    value: "hello@dreamyatri.com",
    href: "mailto:hello@dreamyatri.com",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
    label: "HEAD OFFICE",
    value: "Shimla, Himachal Pradesh - 171001",
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/dreams_yatri",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com/dreamsyatri",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  {
    label: "X / Twitter",
    href: "https://x.com/dreamsyatri",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@dreamsyatri",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
        <polygon points="9.75,15.02 15.5,12 9.75,8.98 9.75,15.02" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/917807727100",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Footer() {
  return (
    <footer className="overflow-hidden mt-3">
      <img src="/footer_banner.webp" alt="footer image" className="w-full aspect-1920/245 translate-y-2 saturate-200 scale-101" />
      <div className="bg-surface-inverse text-slate-300">
        {/* Main grid */}
        <div className="screen-space pt-7 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">

            {/* Left — Brand + Contact */}
            <div className="flex flex-col gap-7">
              {/* Logo */}
              <Link href="/" aria-label="Dreams Yatri home">
                <DyLogo className="w-46 text-primary-500" />
              </Link>

              {/* Tagline */}
              <p className="text-slate-400 text-sm leading-relaxed max-w-[260px]">
                Expert-crafted journeys across India & beyond. Powered by local expertise, transparent pricing, and Avanti AI — since 2019.
              </p>

              {/* Contact */}
              <div className="flex flex-col gap-4">
                {CONTACT_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-slate-400">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-0.5">
                        {item.label}
                      </p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="text-sm text-slate-300 hover:text-white transition-colors"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-300">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Link columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.heading}>
                  <h4 className="text-white font-bold text-sm mb-4">{col.heading}</h4>
                  <ul className="flex flex-col gap-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                        {link.href === "/services/holiday-packages" && (
                          <span className="text-[9px] bg-gradient-to-r from-red-500 to-orange-400 text-white px-2 py-0.5 rounded-full ml-2 leading-none">
                            NEW
                          </span>
                        )}

                        {link.href === "/destinations/kashmir" && (
                          <span className="text-[9px] bg-gradient-to-r from-pink-500 to-red-500 text-white px-2 py-0.5 rounded-full ml-2 leading-none shadow-sm shadow-red-500/30">
                            HOT
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="border-t border-white/[0.07]" />
        </div>

        {/* Bottom bar */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Dreams Yatri. All rights reserved.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="w-9 h-9 rounded-xl bg-white/6 border border-white/[0.07] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.12] hover:border-white/[0.15] transition-all"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}