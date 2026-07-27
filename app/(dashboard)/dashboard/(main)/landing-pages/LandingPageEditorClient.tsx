"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Save, Loader2, ExternalLink, Copy, Plus, Trash2, Star,
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { ImageDropField } from "../../(builder)/package-builder/[packageId]/ImageDropField";
import { saveLandingPage, slugify, type LandingPageInput } from "./actions";
import { PackageItemsEditor, type LandingPageItemRow } from "./PackageItemsEditor";

type Faq = { question: string; answer: string };
type Testimonial = { authorName: string; authorRole: string; quote: string; rating: number };

export type LandingPageInitial = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  seoDescription: string;
  heroImageUrl: string;
  heroEyebrow: string | null;
  heroHeadline: string | null;
  destination: string | null;
  status: "DRAFT" | "PUBLISHED";
  popupDelaySeconds: number;
  contactPhone: string;
  googleAdsSendToForm: string | null;
  googleAdsSendToCall: string | null;
  googleAdsSendToWhatsapp: string | null;
  faqs: Faq[];
  testimonials: Testimonial[];
  items: LandingPageItemRow[];
} | null;

function emptyForm() {
  return {
    slug: "", title: "", seoTitle: "", description: "", seoDescription: "",
    heroImageUrl: "", heroEyebrow: "", heroHeadline: "", destination: "",
    status: "DRAFT" as "DRAFT" | "PUBLISHED",
    popupDelaySeconds: 15, contactPhone: "",
    googleAdsSendToForm: "", googleAdsSendToCall: "", googleAdsSendToWhatsapp: "",
    faqs: [] as Faq[], testimonials: [] as Testimonial[],
  };
}

export function LandingPageEditorClient({ initial }: { initial: LandingPageInitial }) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [form, setForm] = useState(() => (initial ? {
    slug: initial.slug, title: initial.title, seoTitle: initial.seoTitle,
    description: initial.description, seoDescription: initial.seoDescription,
    heroImageUrl: initial.heroImageUrl, heroEyebrow: initial.heroEyebrow ?? "",
    heroHeadline: initial.heroHeadline ?? "", destination: initial.destination ?? "",
    status: initial.status, popupDelaySeconds: initial.popupDelaySeconds,
    contactPhone: initial.contactPhone,
    googleAdsSendToForm: initial.googleAdsSendToForm ?? "",
    googleAdsSendToCall: initial.googleAdsSendToCall ?? "",
    googleAdsSendToWhatsapp: initial.googleAdsSendToWhatsapp ?? "",
    faqs: initial.faqs, testimonials: initial.testimonials,
  } : emptyForm()));
  const [slugTouched, setSlugTouched] = useState(!!initial);

  function field<K extends keyof typeof form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value;
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
  }

  function handleSave() {
    const payload: LandingPageInput = {
      id: initial?.id,
      slug: form.slug,
      title: form.title,
      seoTitle: form.seoTitle,
      description: form.description,
      seoDescription: form.seoDescription,
      heroImageUrl: form.heroImageUrl,
      heroEyebrow: form.heroEyebrow || null,
      heroHeadline: form.heroHeadline || null,
      destination: form.destination || null,
      status: form.status,
      popupDelaySeconds: form.popupDelaySeconds,
      contactPhone: form.contactPhone,
      googleAdsSendToForm: form.googleAdsSendToForm || null,
      googleAdsSendToCall: form.googleAdsSendToCall || null,
      googleAdsSendToWhatsapp: form.googleAdsSendToWhatsapp || null,
      faqs: form.faqs,
      testimonials: form.testimonials,
    };
    startSave(async () => {
      const result = await saveLandingPage(payload);
      if (result.success) {
        toast.success(result.message);
        if (!initial) router.push(`/dashboard/landing-pages/${result.data.id}`);
        else router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function addFaq() {
    setForm((f) => ({ ...f, faqs: [...f.faqs, { question: "", answer: "" }] }));
  }
  function updateFaq(i: number, patch: Partial<Faq>) {
    setForm((f) => ({ ...f, faqs: f.faqs.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) }));
  }
  function removeFaq(i: number) {
    setForm((f) => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) }));
  }

  function addTestimonial() {
    setForm((f) => ({ ...f, testimonials: [...f.testimonials, { authorName: "", authorRole: "", quote: "", rating: 5 }] }));
  }
  function updateTestimonial(i: number, patch: Partial<Testimonial>) {
    setForm((f) => ({ ...f, testimonials: f.testimonials.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) }));
  }
  function removeTestimonial(i: number) {
    setForm((f) => ({ ...f, testimonials: f.testimonials.filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-dashboard-base-content">
            {initial ? "Edit Landing Page" : "New Landing Page"}
          </h1>
          <p className="text-sm text-dashboard-base-content/60">
            Publishes at <span className="font-mono">/offers/{form.slug || "…"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {initial?.status === "PUBLISHED" && (
            <a href={`/offers/${initial.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-1.5"><ExternalLink size={14} /> View live</Button>
            </a>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5 bg-dashboard-primary text-dashboard-base-100 hover:bg-dashboard-primary">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </Button>
        </div>
      </div>

      {/* Basic info */}
      <Section title="Basic Info">
        <Field label="Title">
          <Input value={form.title} onChange={handleTitleChange} placeholder="e.g. Andaman Family Holiday" />
        </Field>
        <Field label="Slug">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-dashboard-base-content/50 whitespace-nowrap">/offers/</span>
            <Input
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }}
              placeholder="andaman-family-holiday"
            />
          </div>
        </Field>
        <Field label="Destination (shown on the lead)">
          <Input value={form.destination} onChange={field("destination")} placeholder="e.g. Andaman" />
        </Field>
        <Field label="Status">
          <div className="flex items-center gap-2.5">
            <Switch checked={form.status === "PUBLISHED"} onCheckedChange={(v) => setForm((f) => ({ ...f, status: v ? "PUBLISHED" : "DRAFT" }))} />
            <span className="text-sm text-dashboard-base-content">{form.status === "PUBLISHED" ? "Published — live to the public" : "Draft — not publicly visible"}</span>
          </div>
        </Field>
      </Section>

      {/* SEO & content */}
      <Section title="Content & SEO">
        <Field label="Description" hint="Shown in the hero / intro copy on the page.">
          <Textarea value={form.description} onChange={field("description")} rows={3} />
        </Field>
        <Field
          label="SEO Title"
          action={<CopyButton onClick={() => setForm((f) => ({ ...f, seoTitle: f.title }))} label="Same as title" />}
        >
          <Input value={form.seoTitle} onChange={field("seoTitle")} placeholder="Shown in Google search results and browser tab" />
        </Field>
        <Field
          label="SEO Description"
          action={<CopyButton onClick={() => setForm((f) => ({ ...f, seoDescription: f.description }))} label="Same as description" />}
        >
          <Textarea value={form.seoDescription} onChange={field("seoDescription")} rows={2} placeholder="Shown under the title in Google search results" />
        </Field>
      </Section>

      {/* Hero image */}
      <Section title="Hero Image">
        <ImageDropField value={form.heroImageUrl} onChange={(url) => setForm((f) => ({ ...f, heroImageUrl: url }))} folder="landing-pages" />
        <Field label="Hero eyebrow (optional)" hint="Small label above the big title — falls back to the title if left blank.">
          <Input value={form.heroEyebrow} onChange={field("heroEyebrow")} placeholder="e.g. Andaman · Family Holiday" />
        </Field>
        <Field label="Hero headline (optional)" hint="Big bold title — falls back to the title if left blank.">
          <Input value={form.heroHeadline} onChange={field("heroHeadline")} placeholder="e.g. FAMILY HOLIDAY" />
        </Field>
      </Section>

      {/* Packages */}
      {initial ? (
        <PackageItemsEditor landingPageId={initial.id} initialItems={initial.items} />
      ) : (
        <Section title="Packages">
          <p className="text-sm text-dashboard-base-content/60">Save the page once with the fields above — you can add package cards right after.</p>
        </Section>
      )}

      {/* Contact & tracking */}
      <ContactAndTracking form={form} setForm={setForm} />

      {/* FAQs */}
      <Section title="FAQs">
        {form.faqs.map((faq, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-dashboard-base-content/60">FAQ {i + 1}</span>
              <button type="button" onClick={() => removeFaq(i)} className="text-red-600 hover:text-red-700"><Trash2 size={14} /></button>
            </div>
            <Input value={faq.question} onChange={(e) => updateFaq(i, { question: e.target.value })} placeholder="Question" />
            <Textarea value={faq.answer} onChange={(e) => updateFaq(i, { answer: e.target.value })} rows={2} placeholder="Answer" />
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addFaq}><Plus size={14} /> Add FAQ</Button>
      </Section>

      {/* Testimonials */}
      <Section title="Testimonials">
        {form.testimonials.map((t, i) => (
          <div key={i} className="rounded-xl border border-dashboard-base-300 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-dashboard-base-content/60">Testimonial {i + 1}</span>
              <button type="button" onClick={() => removeTestimonial(i)} className="text-red-600 hover:text-red-700"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={t.authorName} onChange={(e) => updateTestimonial(i, { authorName: e.target.value })} placeholder="Author name" />
              <Input value={t.authorRole} onChange={(e) => updateTestimonial(i, { authorRole: e.target.value })} placeholder="Role, e.g. Honeymoon, Bengaluru" />
            </div>
            <Textarea value={t.quote} onChange={(e) => updateTestimonial(i, { quote: e.target.value })} rows={2} placeholder="Quote" />
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => updateTestimonial(i, { rating: n })}>
                  <Star size={16} className={n <= t.rating ? "fill-amber-400 text-amber-400" : "text-dashboard-base-300"} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addTestimonial}><Plus size={14} /> Add Testimonial</Button>
      </Section>

      <div className="flex justify-end pb-10">
        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5 bg-dashboard-primary text-dashboard-base-100 hover:bg-dashboard-primary">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </Button>
      </div>
    </div>
  );
}

function ContactAndTracking({ form, setForm }: { form: ReturnType<typeof emptyForm>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>> }) {
  return (
    <Section title="Contact & Tracking">
      <Field label="Contact phone" hint="Used for the Call and WhatsApp buttons.">
        <PhonePicker value={form.contactPhone} onChange={(phone) => setForm((f) => ({ ...f, contactPhone: phone }))} />
      </Field>
      <Field label="Enquiry popup delay (seconds)" hint="The enquiry form auto-opens once, this many seconds after page load.">
        <Input
          type="number" min={0} max={120} value={form.popupDelaySeconds}
          onChange={(e) => setForm((f) => ({ ...f, popupDelaySeconds: Number(e.target.value) || 0 }))}
          className="w-32"
        />
      </Field>
      <Field label="Google Ads conversion — form submit (optional)" hint={'gtag send_to value, e.g. "AW-123456789/AbCdEfGh"'}>
        <Input value={form.googleAdsSendToForm} onChange={(e) => setForm((f) => ({ ...f, googleAdsSendToForm: e.target.value }))} placeholder="AW-XXXXXXXXX/XXXXXXXXXXXXXXXX" />
      </Field>
      <Field label="Google Ads conversion — call click (optional)">
        <Input value={form.googleAdsSendToCall} onChange={(e) => setForm((f) => ({ ...f, googleAdsSendToCall: e.target.value }))} placeholder="AW-XXXXXXXXX/XXXXXXXXXXXXXXXX" />
      </Field>
      <Field label="Google Ads conversion — WhatsApp click (optional)">
        <Input value={form.googleAdsSendToWhatsapp} onChange={(e) => setForm((f) => ({ ...f, googleAdsSendToWhatsapp: e.target.value }))} placeholder="AW-XXXXXXXXX/XXXXXXXXXXXXXXXX" />
      </Field>
    </Section>
  );
}

function PhonePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [members, setMembers] = useState<{ id: string; name: string; phone: string }[] | null>(null);
  const [custom, setCustom] = useState(!value);

  async function loadMembers() {
    if (members) return;
    const mod = await import("./actions");
    setMembers(await mod.listTeamMemberPhones());
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 text-sm text-dashboard-base-content flex-1"
          onFocus={loadMembers}
          value={custom ? "__custom__" : value}
          onChange={(e) => {
            if (e.target.value === "__custom__") { setCustom(true); return; }
            setCustom(false);
            onChange(e.target.value);
          }}
        >
          <option value="">Select a team member&apos;s number…</option>
          {members?.map((m) => (
            <option key={m.id} value={m.phone}>{m.name} — {m.phone}</option>
          ))}
          <option value="__custom__">Custom number…</option>
        </select>
      </div>
      {custom && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. +91 78077 27100" />
      )}
    </div>
  );
}

function CopyButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-dashboard-primary hover:underline">
      <Copy size={12} /> {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
      <h2 className="text-sm font-bold text-dashboard-base-content">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, action, children }: { label: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-dashboard-base-content/90">{label}</label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] text-dashboard-base-content/50">{hint}</p>}
    </div>
  );
}
