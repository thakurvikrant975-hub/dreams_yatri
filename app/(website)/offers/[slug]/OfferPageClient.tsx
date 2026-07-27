"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import {
  Phone, X, Star, Bookmark, ArrowRight, Check, MapPin,
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

// The real WhatsApp glyph (same path data as ShareModal's), not lucide's
// generic MessageCircle — recognizable at a glance as WhatsApp specifically.
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.121 1.532 5.855L.057 23.25l5.532-1.451A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.733 9.733 0 01-4.965-1.361l-.357-.212-3.683.966.982-3.588-.232-.37A9.749 9.749 0 012.25 12C2.25 6.589 6.589 2.25 12 2.25S21.75 6.589 21.75 12 17.411 21.75 12 21.75z" />
    </svg>
  );
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

      <PackageGrid
        items={page.items}
        onEnquire={openEnquiry}
        contactPhone={page.contactPhone}
        onCallClick={handleCallClick}
        onWhatsappClick={handleWhatsappClick}
      />

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

// Matches labels like "3D/2N", "4 D / 3 N", "5D-4N" — the free-text duration
// shorthand admins type into a package's route field. Anything else (an
// actual route/circuit description) is left out of the quick filter row.
const DURATION_PATTERN = /^\d+\s*D\s*[/-]\s*\d+\s*N$/i;

function extractDurations(items: Item[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const label = item.routeLabel?.trim();
    if (label && DURATION_PATTERN.test(label)) seen.add(label);
  }
  return Array.from(seen).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

// Measures against the actual rendered clamp (rather than guessing from
// character count, which varies with card width/font) — only offers "Read
// more" when the text is genuinely being cut off by line-clamp-3.
function PackageDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !expanded) setTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  return (
    <div className="mt-2">
      <p ref={ref} className={`text-sm leading-relaxed text-white/65 ${expanded ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="mt-1 text-xs font-bold text-red-400 hover:text-red-300"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function PackageGrid({
  items, onEnquire, contactPhone, onCallClick, onWhatsappClick,
}: {
  items: Item[];
  onEnquire: (packageName?: string) => void;
  contactPhone: string;
  onCallClick: () => void;
  onWhatsappClick: () => void;
}) {
  const [durationFilter, setDurationFilter] = useState<string | null>(null);
  const durations = useMemo(() => extractDurations(items), [items]);
  const visibleItems = durationFilter ? items.filter((i) => i.routeLabel?.trim() === durationFilter) : items;

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

        {durations.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setDurationFilter(null)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                durationFilter === null ? "border-red-600 bg-red-600 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-red-300 hover:text-red-600"
              }`}
            >
              All Durations
            </button>
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  durationFilter === d ? "border-red-600 bg-red-600 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-red-300 hover:text-red-600"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <article key={item.id} className="group flex h-full flex-col overflow-hidden rounded-2xl bg-neutral-950 shadow-lg shadow-black/10">
              <div className="relative h-56 shrink-0 overflow-hidden">
                <Image
                  src={getCardImage(item.imageUrl)} alt={item.title} fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
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
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-extrabold text-white">{item.title}</h3>
                    {item.priceLabel && (
                      <span className="shrink-0 whitespace-nowrap text-right text-sm font-extrabold text-red-400">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/50">Starting from</span>
                        {item.priceLabel}
                      </span>
                    )}
                  </div>
                  {item.description && <PackageDescription text={item.description} />}
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
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => onEnquire(enquiryPackageName(item))}
                    className="flex-1 rounded-full bg-white py-3 text-sm font-bold text-neutral-900 transition hover:bg-red-600 hover:text-white"
                  >
                    Get a callback
                  </button>
                  <a
                    href={telHref(contactPhone)} onClick={onCallClick} aria-label={`Call about ${item.title}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <Phone size={16} />
                  </a>
                  <a
                    href={whatsappHref(contactPhone, `Hi! I'd like a quote for ${item.title}.`)} target="_blank" rel="noopener noreferrer"
                    onClick={onWhatsappClick} aria-label={`WhatsApp about ${item.title}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-500 text-white transition hover:bg-green-600"
                  >
                    <WhatsAppIcon size={16} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visibleItems.length === 0 && (
          <p className="mt-10 text-center text-sm text-neutral-500">No packages match that duration — try a different filter.</p>
        )}
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
        <WhatsAppIcon size={22} />
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
