"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import {
  Phone, MessageCircle, X, Star, Bookmark, ArrowRight, Check, MapPin,
} from "lucide-react";
import { getHeroImage, getCardImage } from "@/app/lib/imageUrl";
import { LeadForm } from "./LeadForm";
import { getAdsAccountId, fireConversion } from "./gtag";
import { BenefitsSection, JourneySection, TestimonialsSection, FaqSection } from "./ContentSections";

type Item = {
  id: string; title: string; imageUrl: string;
  description: string | null; rating: number | null;
  routeLabel: string | null; priceLabel: string | null; badgeLabel: string | null;
  showInHero: boolean;
};

export type OfferPageData = {
  slug: string;
  title: string;
  description: string;
  heroImageUrl: string;
  heroEyebrow: string | null;
  heroHeadline: string | null;
  destination: string | null;
  popupDelaySeconds: number;
  contactPhone: string;
  googleAdsSendToForm: string | null;
  googleAdsSendToCall: string | null;
  googleAdsSendToWhatsapp: string | null;
  faqs: { question: string; answer: string }[];
  testimonials: { authorName: string; authorRole: string; quote: string; rating: number }[];
  items: Item[];
};

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
function whatsappHref(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}

export function OfferPageClient({ page }: { page: OfferPageData }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPackage, setModalPackage] = useState<string | undefined>(undefined);
  const [popupFired, setPopupFired] = useState(false);
  // Lazy initializer (not an effect) — avoids an extra render just to pick up
  // the real URL; falls back to the slug during SSR, where window doesn't exist.
  const [pageUrl] = useState(() => (typeof window !== "undefined" ? window.location.href : page.slug));

  // Auto-open the enquiry modal once, popupDelaySeconds after load — never
  // reopens itself again this session once the visitor has seen it.
  useEffect(() => {
    if (popupFired) return;
    const t = setTimeout(() => {
      setModalPackage(undefined);
      setModalOpen(true);
      setPopupFired(true);
    }, page.popupDelaySeconds * 1000);
    return () => clearTimeout(t);
  }, [page.popupDelaySeconds, popupFired]);

  const adsAccountId = useMemo(
    () => getAdsAccountId([page.googleAdsSendToForm, page.googleAdsSendToCall, page.googleAdsSendToWhatsapp]),
    [page],
  );

  function openEnquiry(packageName?: string) {
    setModalPackage(packageName);
    setModalOpen(true);
  }

  function handleCallClick() {
    fireConversion(page.googleAdsSendToCall);
  }
  function handleWhatsappClick() {
    fireConversion(page.googleAdsSendToWhatsapp);
  }

  return (
    <div className="bg-white">
      {adsAccountId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${adsAccountId}`} strategy="afterInteractive" />
          <Script id="offer-gtag-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${adsAccountId}');`}
          </Script>
        </>
      )}

      <Hero page={page} onEnquire={() => openEnquiry(undefined)} />

      <PackageGrid items={page.items} onEnquire={openEnquiry} />

      <BenefitsSection />
      <JourneySection destination={page.destination} />
      <TestimonialsSection testimonials={page.testimonials} destination={page.destination} />
      <FaqSection faqs={page.faqs} />

      <LeadFormSection page={page} pageUrl={pageUrl} onSuccess={() => {}} />

      <StickyCta onEnquire={() => openEnquiry(undefined)} />
      <FloatingButtons contactPhone={page.contactPhone} onCallClick={handleCallClick} onWhatsappClick={handleWhatsappClick} title={page.title} />

      {modalOpen && (
        <EnquiryModal
          onClose={() => setModalOpen(false)}
          destination={page.destination}
          packageName={modalPackage}
          pageUrl={pageUrl}
          googleAdsSendToForm={page.googleAdsSendToForm}
          contactPhone={page.contactPhone}
          onCallClick={handleCallClick}
        />
      )}
    </div>
  );
}

// Pulls the lowest priceLabel across the page's items (e.g. "₹16,999/person")
// by comparing the digits inside each label — the labels are free-text set by
// admins, so this is a best-effort "starting from" figure, not exact math.
function cheapestPrice(items: Item[]): string | null {
  let best: { label: string; value: number } | null = null;
  for (const item of items) {
    if (!item.priceLabel) continue;
    const digits = item.priceLabel.replace(/[^\d]/g, "");
    if (!digits) continue;
    const value = Number(digits);
    if (!best || value < best.value) best = { label: item.priceLabel, value };
  }
  return best?.label ?? null;
}

function Hero({ page, onEnquire }: { page: OfferPageData; onEnquire: () => void }) {
  const packageCount = page.items.length;
  const startingFrom = useMemo(() => cheapestPrice(page.items), [page.items]);

  return (
    <section className="relative -mt-header-height flex min-h-[90vh] items-center overflow-hidden bg-neutral-900 pb-14 pt-28 sm:min-h-[85vh] sm:pb-20">
      <Image src={getHeroImage(page.heroImageUrl)} alt="" fill priority className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/20" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
        <div className="max-w-2xl">
          {page.destination && (
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <MapPin size={12} /> {page.destination}
            </div>
          )}
          <span className="block text-sm font-semibold uppercase tracking-wide text-red-300">
            {page.heroEyebrow || page.title}
          </span>
          <h1 className="mt-3 text-5xl font-extrabold uppercase leading-[1.05] text-white sm:text-7xl">
            {page.heroHeadline || page.title}
          </h1>
          <p className="mt-5 max-w-lg text-sm text-white/85 sm:text-base">{page.description}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onEnquire}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-8 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-red-700"
            >
              Explore <ArrowRight size={16} />
            </button>
            {packageCount > 0 && (
              <a
                href="#packages"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                View Packages
              </a>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/90">
            <div className="flex items-center gap-1.5">
              <span className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} className="fill-amber-400" />)}
              </span>
              <span>Rated 4.8/5 by 2,300+ happy travellers</span>
            </div>
            {startingFrom && (
              <>
                <span className="text-white/30">•</span>
                <span className="font-semibold text-white">Starting from {startingFrom}</span>
              </>
            )}
            {packageCount > 0 && (
              <>
                <span className="text-white/30">•</span>
                <span className="font-semibold text-white">
                  {packageCount} curated package{packageCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Matches the reference's data-package convention — price/route travel with
// the enquiry (so nothing is lost), they just aren't printed on the card
// face itself, matching the reference design's card layout.
function enquiryPackageName(item: Item): string {
  const suffix = [item.routeLabel, item.priceLabel].filter(Boolean).join(" — ");
  return suffix ? `${item.title} (${suffix})` : item.title;
}

function PackageGrid({ items, onEnquire }: { items: Item[]; onEnquire: (packageName?: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section id="packages" className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-red-600">Packages</span>
          <h2 className="mt-1.5 text-2xl font-extrabold text-neutral-900 sm:text-3xl">Tour Packages for Every Traveller</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">
            Handpicked resorts, transfers &amp; sightseeing on every trip. Tap a package and our travel expert will send you a free custom quote — no obligation.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="flex h-full flex-col overflow-hidden rounded-2xl bg-neutral-950 shadow-lg shadow-black/10">
              <div className="relative h-56 shrink-0">
                <Image src={getCardImage(item.imageUrl)} alt={item.title} fill className="object-cover" />
                {item.badgeLabel && (
                  <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                    {item.badgeLabel}
                  </span>
                )}
                <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                  <Bookmark size={14} />
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex-1">
                  <h3 className="text-xl font-extrabold text-white">{item.title}</h3>
                  {item.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/65">{item.description}</p>
                  )}
                  {(item.rating != null || item.routeLabel) && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                      {item.rating != null && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                          <Star size={11} className="fill-amber-400 text-amber-400" /> {item.rating.toFixed(1)}
                        </span>
                      )}
                      {item.routeLabel && (
                        <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold text-white">{item.routeLabel}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onEnquire(enquiryPackageName(item))}
                  className="mt-4 w-full rounded-full bg-white py-3 text-sm font-bold text-neutral-900 transition hover:bg-red-600 hover:text-white"
                >
                  Enquire Now
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeadFormSection({ page, pageUrl, onSuccess }: { page: OfferPageData; pageUrl: string; onSuccess: () => void }) {
  return (
    <section id="lead-form" className="bg-neutral-900 py-14 sm:py-20">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-extrabold text-neutral-900">Get Your Free Quote</h2>
          <p className="mt-1 text-sm text-neutral-500">Takes less than 30 seconds.</p>
          <LeadForm
            destination={page.destination}
            pageUrl={pageUrl}
            googleAdsSendToForm={page.googleAdsSendToForm}
            onSuccess={onSuccess}
            className="mt-4"
          />
        </div>
      </div>
    </section>
  );
}

function StickyCta({ onEnquire }: { onEnquire: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:hidden">
      <div className="text-sm">
        <p className="font-bold text-neutral-900">Ready to explore?</p>
        <p className="text-xs text-neutral-500">Free quote in a few hours</p>
      </div>
      <button onClick={onEnquire} className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white">Get Quote</button>
    </div>
  );
}

function FloatingButtons({
  contactPhone, onCallClick, onWhatsappClick, title,
}: { contactPhone: string; onCallClick: () => void; onWhatsappClick: () => void; title: string }) {
  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col gap-3 sm:bottom-6">
      <a
        href={telHref(contactPhone)} onClick={onCallClick} aria-label="Call us"
        className="flex size-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg"
      >
        <Phone size={20} />
      </a>
      <a
        href={whatsappHref(contactPhone, `Hi! I'd like a quote for ${title}.`)} target="_blank" rel="noopener noreferrer"
        onClick={onWhatsappClick} aria-label="Chat on WhatsApp"
        className="flex size-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg"
      >
        <MessageCircle size={22} />
      </a>
    </div>
  );
}

function EnquiryModal({
  onClose, destination, packageName, pageUrl, googleAdsSendToForm, contactPhone, onCallClick,
}: {
  onClose: () => void; destination: string | null; packageName?: string; pageUrl: string; googleAdsSendToForm: string | null;
  contactPhone: string; onCallClick: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <style>{`
        @keyframes eqm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes eqm-pop { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .eqm-overlay { animation: eqm-fade 0.25s ease both; }
        .eqm-dialog { animation: eqm-pop 0.3s cubic-bezier(.22,.8,.28,1) both; }
      `}</style>
      <div className="eqm-overlay absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />
      <div className="eqm-dialog relative max-h-[92vh] w-full max-w-115 overflow-y-auto rounded-[22px] bg-white p-7 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-[22px] bg-linear-to-r from-red-600 to-orange-400" />
        <button
          onClick={onClose} aria-label="Close"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="pt-1 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check size={28} strokeWidth={2.5} />
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-neutral-900">Thank you! 🎉</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
              We&apos;ve received your enquiry{packageName ? ` for ${packageName}` : ""}. Our travel expert will call or WhatsApp you shortly with a custom quote — completely free, no obligation.
            </p>
          </div>
        ) : (
          <>
            <h3 className="pr-9 text-xl font-extrabold text-neutral-900">Get Your Free Custom Quote</h3>
            {packageName && (
              <span className="mt-2 inline-block max-w-full truncate rounded-full bg-red-50 px-4 py-1.5 text-sm font-bold text-red-600">
                {packageName}
              </span>
            )}
            <p className="mt-2.5 text-sm text-neutral-500">
              Share your details and our travel expert will send a personalised itinerary &amp; price — usually within a few hours. No obligation.
            </p>
            <LeadForm
              destination={destination}
              packageName={packageName}
              pageUrl={pageUrl}
              googleAdsSendToForm={googleAdsSendToForm}
              onSuccess={() => setSubmitted(true)}
              className="mt-5"
            />
            <div className="mt-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" /> or <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <a
              href={telHref(contactPhone)}
              onClick={onCallClick}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-green-600 py-3 text-sm font-bold text-green-600 transition hover:border-green-500"
            >
              <Phone size={16} /> Call {contactPhone}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
