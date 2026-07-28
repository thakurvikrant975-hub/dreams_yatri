import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLandingPage } from "../actions";
import { LandingPageEditorClient } from "../LandingPageEditorClient";

export const metadata: Metadata = {
  title: "Edit Landing Page - Dashboard",
  description: "",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getLandingPage(id);
  if (!page) notFound();

  return (
    <LandingPageEditorClient
      initial={{
        id: page.id,
        slug: page.slug,
        title: page.title,
        seoTitle: page.seoTitle,
        description: page.description,
        seoDescription: page.seoDescription,
        heroImageUrl: page.heroImageUrl,
        heroEyebrow: page.heroEyebrow,
        heroHeadline: page.heroHeadline,
        destination: page.destination,
        status: page.status,
        popupDelaySeconds: page.popupDelaySeconds,
        contactPhone: page.contactPhone,
        googleAdsSendToForm: page.googleAdsSendToForm,
        googleAdsSendToCall: page.googleAdsSendToCall,
        googleAdsSendToWhatsapp: page.googleAdsSendToWhatsapp,
        faqs: page.faqs as { question: string; answer: string }[],
        testimonials: page.testimonials as { authorName: string; authorRole: string; quote: string; rating: number }[],
        items: page.items,
      }}
    />
  );
}
