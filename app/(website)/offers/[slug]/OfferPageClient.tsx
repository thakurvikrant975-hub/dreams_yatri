"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { Phone, MessageCircle, X } from "lucide-react";
import { getHeroImage, getCardImage } from "@/app/lib/imageUrl";
import { LeadForm } from "./LeadForm";
import { getAdsAccountId, fireConversion } from "./gtag";
import { BenefitsSection, JourneySection, TestimonialsSection, FaqSection } from "./ContentSections";

type Item = {
  id: string; title: string; imageUrl: string;
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

  const heroItems = useMemo(() => {
    const marked = page.items.filter((i) => i.showInHero);
    return (marked.length > 0 ? marked : page.items).slice(0, 4);
  }, [page.items]);

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

      <Hero page={page} heroItems={heroItems} onEnquire={() => openEnquiry(undefined)} />

      <PackageGrid items={page.items} onEnquire={openEnquiry} />

      <BenefitsSection />
      <JourneySection />
      <TestimonialsSection testimonials={page.testimonials} />
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
        />
      )}
    </div>
  );
}

function Hero({ page, heroItems, onEnquire }: { page: OfferPageData; heroItems: Item[]; onEnquire: () => void }) {
  const slides = heroItems.length > 0 ? heroItems : [{ id: "default", title: page.title, imageUrl: page.heroImageUrl, routeLabel: null, priceLabel: null, badgeLabel: null, showInHero: false }];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setActive((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[active];

  return (
    <section className="relative -mt-header-height flex min-h-[90vh] items-end overflow-hidden bg-neutral-900 sm:min-h-[85vh]">
      {slides.map((s, i) => (
        <Image
          key={s.id}
          src={getHeroImage(s.imageUrl || page.heroImageUrl)}
          alt=""
          fill
          priority={i === 0}
          className={`object-cover transition-opacity duration-700 ${i === active ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 pt-32 sm:pb-20">
        <span className="text-sm font-semibold uppercase tracking-wide text-red-300">
          {page.heroEyebrow || page.title}
        </span>
        <h1 className="mt-2 max-w-xl text-4xl font-extrabold uppercase leading-none text-white sm:text-6xl">
          {page.heroHeadline || current.title || page.title}
        </h1>
        <p className="mt-4 max-w-lg text-sm text-white/85 sm:text-base">{page.description}</p>
        <button
          onClick={onEnquire}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700"
        >
          Get a Free Quote
        </button>

        {slides.length > 1 && (
          <div className="mt-8 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                aria-label={`Show ${s.title}`}
                className={`h-1.5 rounded-full transition-all ${i === active ? "w-8 bg-red-500" : "w-4 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PackageGrid({ items, onEnquire }: { items: Item[]; onEnquire: (packageName?: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section id="packages" className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-red-600">Packages</span>
          <h2 className="mt-1.5 text-2xl font-extrabold text-neutral-900 sm:text-3xl">Tour Packages for Every Traveller</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="relative h-44 w-full">
                <Image src={getCardImage(item.imageUrl)} alt={item.title} fill className="object-cover" />
                {item.badgeLabel && (
                  <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                    {item.badgeLabel}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-neutral-900">{item.title}</h3>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                  {item.routeLabel && <span>{item.routeLabel}</span>}
                  {item.priceLabel && <span className="font-semibold text-neutral-700">{item.priceLabel}</span>}
                </div>
                <button
                  onClick={() => onEnquire(item.title)}
                  className="mt-3 w-full rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
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
  onClose, destination, packageName, pageUrl, googleAdsSendToForm,
}: {
  onClose: () => void; destination: string | null; packageName?: string; pageUrl: string; googleAdsSendToForm: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-700">
          <X size={18} />
        </button>
        <h3 className="text-lg font-extrabold text-neutral-900">Get Your Free Custom Quote</h3>
        {packageName && <p className="mt-0.5 text-sm font-semibold text-red-600">{packageName}</p>}
        <p className="mt-1.5 text-xs text-neutral-500">Share your details and our travel expert will send a personalised itinerary &amp; price — usually within a few hours.</p>
        <LeadForm
          destination={destination}
          packageName={packageName}
          pageUrl={pageUrl}
          googleAdsSendToForm={googleAdsSendToForm}
          className="mt-4"
        />
      </div>
    </div>
  );
}
