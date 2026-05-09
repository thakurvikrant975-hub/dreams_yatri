"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
  MapPin, Calendar, Users, Phone, Mail, Hotel, Car, Zap,
  Utensils, ChevronDown, ChevronUp, Plus, Trash2,
  Save, Send, CheckCircle, AlertCircle, Loader2,
  Package, User, Info, IndianRupee, ArrowLeft,
  Eye, EyeOff,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { cn } from "@/app/lib/utils";
import {
  getQueryDetail,
  saveCustomPackage,
  sendPackageToClient,
  type QueryDetail,
  type DayItinerary,
} from "../action";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MEAL_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Tea & Snacks"];

const ACTIVITY_LABELS: Record<string, string> = {
  PARAGLIDING:   "Paragliding",
  RIVER_RAFTING: "River Rafting",
  TREKKING:      "Trekking",
  SKIING:        "Skiing",
  CAMPING:       "Camping",
};

const STAY_LABELS: Record<string, string> = {
  STAR_3: "3★ Hotel", STAR_4: "4★ Hotel", STAR_5: "5★ Hotel",
  BOUTIQUE: "Boutique", HOMESTAY: "Homestay",
  RESORT: "Resort", CAMP: "Camp", BUDGET: "Budget",
};

const CAB_LABELS: Record<string, string> = {
  SEDAN: "Sedan", SUV: "SUV", TEMPO: "Tempo Traveller", BUS: "Bus",
};

const DEFAULT_INCLUSIONS = [
  "Accommodation as per itinerary",
  "Daily breakfast",
  "All transfers by private cab",
  "GST & service taxes",
];

const DEFAULT_EXCLUSIONS = [
  "Airfare / train tickets",
  "Personal expenses",
  "Meals not mentioned",
  "Adventure activity charges",
];

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ label, color = "default" }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    blue:    "bg-dashboard-secondary/10 text-dashboard-secondary border-dashboard-secondary/30",
    green:   "bg-dashboard-success/10 text-dashboard-success border-dashboard-success/30",
    amber:   "bg-dashboard-warning/10 text-dashboard-warning-content border-dashboard-warning/30",
    violet:  "bg-dashboard-primary/10 text-dashboard-primary border-dashboard-primary/30",
    default: "bg-dashboard-base-200 text-dashboard-base-content/60 border-dashboard-base-300",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[color] ?? map.default)}>
      {label}
    </span>
  );
}

function SectionCard({
  title, icon, children, defaultOpen = true,
}: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-dashboard-neutral transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-dashboard-neutral-content">
          <span className="text-dashboard-neutral-content">{icon}</span>
          {title}
        </div>
        {open
          ? <ChevronUp size={14} className="text-dashboard-base-content/50" />
          : <ChevronDown size={14} className="text-dashboard-base-content/50" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 border-t border-r border-l border-b border-dashboard-base-300">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-dashboard-base-content/50 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="font-medium text-dashboard-base-content flex-1">{value}</span>
    </div>
  );
}

function SpecialNote({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-2 rounded-lg bg-dashboard-warning/10 border border-dashboard-warning/30 px-3 py-2 mt-1">
      <AlertCircle size={13} className="text-dashboard-warning shrink-0 mt-0.5" />
      <p className="text-xs text-dashboard-warning-content">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditableList
// ─────────────────────────────────────────────────────────────────────────────
function EditableList({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !items.includes(val)) { onChange([...items, val]); setInput(""); }
  }
  return (
    <div>
      <label className="text-xs font-medium text-dashboard-base-content/50 mb-2 block">{label}</label>
      <div className="flex gap-2 mb-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder ?? "Add item…"}
          className="text-sm h-9 flex-1 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={add}
          className="h-9 px-3 border-dashboard-base-300 hover:bg-dashboard-base-200"
        >
          <Plus size={14} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1 text-xs bg-dashboard-base-200 text-dashboard-base-content px-2.5 py-1 rounded-full border border-dashboard-base-300"
          >
            {item}
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-dashboard-base-content/50 hover:text-dashboard-error transition-colors ml-0.5"
            >×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Itinerary Card
// ─────────────────────────────────────────────────────────────────────────────
function DayCard({ day, data, onChange, onRemove }: {
  day: number;
  data: DayItinerary;
  onChange: (d: DayItinerary) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  function toggleMeal(m: string) {
    const meals = data.meals.includes(m)
      ? data.meals.filter((x) => x !== m)
      : [...data.meals, m];
    onChange({ ...data, meals });
  }

  return (
    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dashboard-base-100 border-b border-dashboard-base-300">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
          <div className="h-7 w-7 rounded-lg bg-dashboard-primary text-dashboard-primary-content text-xs font-bold flex items-center justify-center shrink-0">
            {day}
          </div>
          <div className="flex-1 min-w-0">
            {open
              ? <Input
                  value={data.title}
                  onChange={(e) => onChange({ ...data, title: e.target.value })}
                  placeholder={`Day ${day} title…`}
                  className="h-7 text-sm font-semibold border-0 p-0 shadow-none bg-transparent focus-visible:ring-0 text-dashboard-base-content"
                  onClick={(e) => e.stopPropagation()}
                />
              : <span className="text-sm font-semibold truncate text-dashboard-base-content">
                  {data.title || `Day ${day}`}
                </span>
            }
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setOpen(!open)}
            className="p-1 rounded hover:bg-dashboard-base-300 transition-colors text-dashboard-base-content/50"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-dashboard-error/10 text-dashboard-error transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Day Description</label>
            <Textarea
              value={data.description}
              onChange={(e) => onChange({ ...data, description: e.target.value })}
              placeholder="Describe the day's plan, sightseeing, transfers…"
              rows={3}
              className="text-sm resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
            />
          </div>

          {/* Accommodation + Transport */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 flex items-center gap-1 block">
                <Hotel size={11} /> Accommodation
              </label>
              <Input
                value={data.accommodation}
                onChange={(e) => onChange({ ...data, accommodation: e.target.value })}
                placeholder="Hotel name / type"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 flex items-center gap-1 block">
                <Car size={11} /> Transport
              </label>
              <Input
                value={data.transport}
                onChange={(e) => onChange({ ...data, transport: e.target.value })}
                placeholder="Cab type / route"
                className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
              />
            </div>
          </div>

          {/* Meals */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 flex items-center gap-1 block">
              <Utensils size={11} /> Meals Included
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMeal(m)}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border font-medium transition-all",
                    data.meals.includes(m)
                      ? "bg-dashboard-primary text-dashboard-primary-content border-dashboard-primary"
                      : "bg-dashboard-base-200 text-dashboard-base-content/50 border-dashboard-base-300 hover:border-dashboard-primary/50 hover:text-dashboard-primary"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 flex items-center gap-1 block">
              <Zap size={11} /> Activities
            </label>
            <Input
              value={data.activities.join(", ")}
              onChange={(e) =>
                onChange({
                  ...data,
                  activities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Paragliding, River Rafting, Trekking… (comma separated)"
              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Notes</label>
            <Input
              value={data.notes}
              onChange={(e) => onChange({ ...data, notes: e.target.value })}
              placeholder="Any additional note for this day…"
              className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Form State Type
// ─────────────────────────────────────────────────────────────────────────────
interface PackageForm {
  title:          string;
  destination:    string;
  startingPoint:  string;
  totalDays:      number;
  totalNights:    number;
  travelDate:     string;
  adults:         number;
  children:       number;
  infants:        number;
  pricePerPerson: string;
  totalPrice:     string;
  currency:       string;
  inclusions:     string[];
  exclusions:     string[];
  termsNotes:     string;
  itineraries:    DayItinerary[];
}

const emptyDay = (day: number): DayItinerary => ({
  day, title: "", description: "", activities: [],
  meals: [], accommodation: "", transport: "", notes: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PackageBuilderDetailPage() {
  const params  = useParams<{ queryId: string }>();
  const queryId = params.queryId;

  const [query,     setQuery]     = useState<QueryDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [sideOpen,  setSideOpen]  = useState(false);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [savedOk,   setSavedOk]   = useState(false);

  const [isSaving,  startSave] = useTransition();
  const [isSending, startSend] = useTransition();

  const [form, setForm] = useState<PackageForm>({
    title: "", destination: "", startingPoint: "",
    totalDays: 3, totalNights: 2, travelDate: "",
    adults: 1, children: 0, infants: 0,
    pricePerPerson: "", totalPrice: "",
    currency: "INR",
    inclusions:  DEFAULT_INCLUSIONS,
    exclusions:  DEFAULT_EXCLUSIONS,
    termsNotes:  "Package price is subject to availability. 50% advance required to confirm booking.",
    itineraries: [emptyDay(1), emptyDay(2), emptyDay(3)],
  });

  // ── Load query ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const data = await getQueryDetail(queryId);
      setQuery(data);
      if (!data) { setLoading(false); return; }

      const r = data.requirements;
      const j = r?.journey;
      const t = r?.travellers;

      setForm((f) => ({
        ...f,
        title:         `${j?.destinations?.[0] ?? data.destination ?? "Custom"} Tour Package`,
        destination:   j?.destinations?.join(", ") ?? data.destination ?? "",
        startingPoint: j?.startingPoint ?? "",
        totalDays:     j?.noOfDays ?? 3,
        totalNights:   j?.noOfNights ?? 2,
        travelDate:    j?.travelDate ?? (data.travelDate ? new Date(data.travelDate).toISOString().split("T")[0] : ""),
        adults:        t?.adults ?? 1,
        children:      t?.children ?? 0,
        infants:       t?.infants ?? 0,
        itineraries:   Array.from({ length: j?.noOfDays ?? 3 }, (_, i) => emptyDay(i + 1)),
      }));

      if (data.customPackage) {
        const cp = data.customPackage;
        setPackageId(cp.id);
        setForm((f) => ({
          ...f,
          title:          cp.title,
          pricePerPerson: cp.pricePerPerson?.toString() ?? "",
          totalPrice:     cp.totalPrice?.toString() ?? "",
          itineraries:    cp.itineraries.length > 0 ? cp.itineraries : f.itineraries,
        }));
      }

      setLoading(false);
    })();
  }, [queryId]);

  // ── Auto-calc total price ──────────────────────────────────────────────────
  useEffect(() => {
    const pp = parseFloat(form.pricePerPerson);
    if (!isNaN(pp)) {
      setForm((f) => ({ ...f, totalPrice: String(pp * (f.adults + f.children)) }));
    }
  }, [form.pricePerPerson, form.adults, form.children]);

  // ── Save ───────────────────────────────────────────────────────────────────
  function handleSave(status: "DRAFT" | "READY" = "DRAFT") {
    startSave(async () => {
      const result = await saveCustomPackage({
        queryId,
        ...form,
        pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
        totalPrice:     form.totalPrice     ? parseFloat(form.totalPrice)     : null,
        status,
        builtBy:     "current-user-id",
        builtByName: "Sales Executive",
      });
      if (result.success) {
        setPackageId(result.id);
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
      }
    });
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend() {
    startSend(async () => {
      let pkgId = packageId;
      if (!pkgId) {
        const result = await saveCustomPackage({
          queryId,
          ...form,
          pricePerPerson: form.pricePerPerson ? parseFloat(form.pricePerPerson) : null,
          totalPrice:     form.totalPrice     ? parseFloat(form.totalPrice)     : null,
          status:      "READY",
          builtBy:     "current-user-id",
          builtByName: "Sales Executive",
        });
        if (!result.success) return;
        pkgId = result.id;
        setPackageId(pkgId);
      }
      const result = await sendPackageToClient(pkgId);
      if (result.success && result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank");
      }
    });
  }

  // ── Day helpers ────────────────────────────────────────────────────────────
  function addDay() {
    setForm((f) => {
      const next = f.itineraries.length + 1;
      return {
        ...f,
        itineraries: [...f.itineraries, emptyDay(next)],
        totalDays:   next,
        totalNights: next - 1,
      };
    });
  }

  function removeDay(idx: number) {
    setForm((f) => {
      const days = f.itineraries
        .filter((_, i) => i !== idx)
        .map((d, i) => ({ ...d, day: i + 1 }));
      return { ...f, itineraries: days, totalDays: days.length, totalNights: Math.max(0, days.length - 1) };
    });
  }

  function updateDay(idx: number, day: DayItinerary) {
    setForm((f) => {
      const its = [...f.itineraries];
      its[idx]  = day;
      return { ...f, itineraries: its };
    });
  }

  function field<K extends keyof PackageForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  // ── Loading / not found ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dashboard-base-200">
        <Loader2 className="animate-spin text-dashboard-primary h-8 w-8" />
      </div>
    );
  }
  if (!query) {
    return (
      <div className="h-screen flex items-center justify-center text-dashboard-base-content/50 text-sm bg-dashboard-base-200">
        Query not found.
      </div>
    );
  }

  const r  = query.requirements;
  const j  = r?.journey;
  const t  = r?.travellers;
  const b  = r?.budget;
  const s  = r?.stay;
  const tr = r?.transport;
  const ac = r?.activities;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-dashboard-base-300 bg-dashboard-base-100/95 backdrop-blur rounded-xl mb-6">
        <div className="flex items-center justify-between px-4 h-14 gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.close()}
              className="text-dashboard-base-content/50 hover:text-dashboard-base-content transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate leading-tight text-dashboard-base-content">
                {query.name}
              </h1>
              <p className="text-xs text-dashboard-base-content/50 truncate">
                {j?.destinations?.join(" › ") ?? query.destination ?? "—"}
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden h-8 gap-1 border-dashboard-base-300 hover:bg-dashboard-base-200 rounded-md"
              onClick={() => setSideOpen(!sideOpen)}
            >
              {sideOpen ? <EyeOff size={13} /> : <Eye size={13} />}
              <span className="text-xs">Details</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content rounded-md"
              onClick={() => handleSave("DRAFT")}
              disabled={isSaving || isSending}
            >
              {isSaving
                ? <Loader2 size={13} className="animate-spin" />
                : savedOk
                ? <CheckCircle size={13} className="text-dashboard-success" />
                : <Save size={13} />
              }
              <span className="hidden sm:inline text-xs">
                {savedOk ? "Saved!" : "Save Draft"}
              </span>
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1.5 bg-dashboard-secondary text-dashboard-secondary-content hover:bg-dashboard-secondary/90 rounded-md"
              onClick={handleSend}
            >
              <Eye size={13} />
              <span className="hidden sm:inline text-xs">Live Preview</span>
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1.5 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90 rounded-md"
              onClick={handleSend}
              disabled={isSending || isSaving}
            >
              {isSending
                ? <Loader2 size={13} className="animate-spin" />
                : <Send size={13} />
              }
              <span className="hidden sm:inline text-xs">Send to Client</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
<div className="flex relative h-[calc(100vh-3.5rem)]">


        {/* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */}
<aside className="w-80 lg:w-96 shrink-0 hidden sm:block overflow-y-auto h-full">
          <div className="px-4 pb-4 space-y-3">
            <ClientDetailsSidebar query={query} j={j} t={t} b={b} s={s} tr={tr} ac={ac} />
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sideOpen && (
          <div
            className="sm:hidden fixed inset-0 z-20 flex"
            onClick={() => setSideOpen(false)}
          >
            <aside
              className="w-80 max-w-[85vw] bg-dashboard-base-100 border-r border-dashboard-base-300 overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-dashboard-base-300 sticky top-0 bg-dashboard-base-100">
                <span className="text-sm font-semibold text-dashboard-base-content">Client Details</span>
                <button onClick={() => setSideOpen(false)}>
                  <EyeOff size={15} className="text-dashboard-base-content/50" />
                </button>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <ClientDetailsSidebar query={query} j={j} t={t} b={b} s={s} tr={tr} ac={ac} />
              </div>
            </aside>
            <div className="flex-1 bg-dashboard-neutral/40" />
          </div>
        )}

        {/* ── RIGHT: Package Builder ─────────────────────────────────────────── */}
<main className="flex-1 overflow-y-auto h-full">
          <div className="max-w-5xl mx-auto px-4 pb-4 space-y-6">

            {/* Package Overview */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                <Package size={15} className="text-dashboard-primary" /> Package Overview
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Package Title *</label>
                  <Input
                    value={form.title}
                    onChange={field("title")}
                    placeholder="e.g. Manali Adventure Package"
                    className="text-sm border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Destination(s)</label>
                  <Input
                    value={form.destination}
                    onChange={field("destination")}
                    placeholder="Manali, Bhuntar, Kullu"
                    className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Starting Point</label>
                  <Input
                    value={form.startingPoint}
                    onChange={field("startingPoint")}
                    placeholder="Delhi"
                    className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Travel Date</label>
                  <Input
                    type="date"
                    value={form.travelDate}
                    onChange={field("travelDate")}
                    className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Duration</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number" min={1}
                        value={form.totalDays}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          totalDays:   +e.target.value,
                          totalNights: Math.max(0, +e.target.value - 1),
                        }))}
                        className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                      />
                      <p className="text-xs text-dashboard-base-content/50 mt-0.5 text-center">Days</p>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number" min={0}
                        value={form.totalNights}
                        onChange={(e) => setForm((f) => ({ ...f, totalNights: +e.target.value }))}
                        className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                      />
                      <p className="text-xs text-dashboard-base-content/50 mt-0.5 text-center">Nights</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Travellers & Pricing */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                <IndianRupee size={15} className="text-dashboard-primary" /> Travellers & Pricing
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {(["adults", "children", "infants"] as const).map((key) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block capitalize">{key}</label>
                    <Input
                      type="number" min={0}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: +e.target.value }))}
                      className="text-sm h-9 text-center border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">₹ / Person</label>
                  <Input
                    type="number" min={0}
                    value={form.pricePerPerson}
                    onChange={field("pricePerPerson")}
                    placeholder="0"
                    className="text-sm h-9 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-dashboard-base-content/50 mb-1.5 block">Total ₹</label>
                  <Input
                    type="number" min={0}
                    value={form.totalPrice}
                    onChange={field("totalPrice")}
                    placeholder="Auto"
                    className="text-sm h-9 bg-dashboard-base-200 border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
                  />
                </div>
              </div>
            </div>

            {/* Day-wise Itinerary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                  <Calendar size={15} className="text-dashboard-primary" />
                  Day-wise Itinerary
                  <Badge variant="outline" className="text-xs font-normal border-dashboard-base-300 text-dashboard-base-content/50">
                    {form.itineraries.length} days
                  </Badge>
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-dashboard-base-300 duration-300 transition-transform hover:scale-105 text-dashboard-base-content rounded-md"
                  onClick={addDay}
                >
                  <Plus size={13} /> Add Day
                </Button>
              </div>

              {form.itineraries.map((day, idx) => (
                <DayCard
                  key={`day-${day.day}`}
                  day={day.day}
                  data={day}
                  onChange={(d) => updateDay(idx, d)}
                  onRemove={() => removeDay(idx)}
                />
              ))}
            </div>

            {/* Inclusions & Exclusions */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-5">
              <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                <CheckCircle size={15} className="text-dashboard-primary" /> Inclusions & Exclusions
              </h2>
              <EditableList
                label="✅ Inclusions"
                items={form.inclusions}
                onChange={(v) => setForm((f) => ({ ...f, inclusions: v }))}
                placeholder="Add inclusion…"
              />
              <EditableList
                label="❌ Exclusions"
                items={form.exclusions}
                onChange={(v) => setForm((f) => ({ ...f, exclusions: v }))}
                placeholder="Add exclusion…"
              />
            </div>

            {/* Terms & Notes */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-dashboard-base-content">
                <Info size={15} className="text-dashboard-primary" /> Terms & Notes
              </h2>
              <Textarea
                value={form.termsNotes}
                onChange={field("termsNotes")}
                rows={4}
                placeholder="Payment terms, cancellation policy, important notes…"
                className="text-sm resize-none border-dashboard-base-300 focus-visible:ring-dashboard-primary/20 focus-visible:border-dashboard-primary"
              />
            </div>

            {/* Bottom action bar */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 pb-10">
              <Button
                variant="outline"
                onClick={() => handleSave("DRAFT")}
                disabled={isSaving || isSending}
                className="gap-2 border-dashboard-base-300 hover:bg-dashboard-base-200 text-dashboard-base-content"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Draft
              </Button>
              <Button
                className="gap-2 bg-dashboard-secondary text-dashboard-secondary-content hover:bg-dashboard-secondary/90"
                onClick={handleSend}
              >
                <Eye size={14} />
                Live Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave("READY")}
                disabled={isSaving || isSending}
                className="gap-2 border-dashboard-primary text-dashboard-primary hover:bg-dashboard-primary/10"
              >
                <CheckCircle size={14} />
                Mark Ready
              </Button>
              <Button
                className="gap-2 bg-dashboard-success text-dashboard-success-content hover:bg-dashboard-success/90"
                onClick={handleSend}
                disabled={isSending || isSaving}
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send to Client
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetailsSidebar({ query, j, t, b, s, tr, ac }: {
  query: QueryDetail;
  j: any; t: any; b: any; s: any; tr: any; ac: any;
}) {
  return (
    <>
      <SectionCard title="Client Info" icon={<User size={14} />}>
        <InfoRow label="Name" value={query.name} />
        <InfoRow
          label="Phone"
          value={
            <a
              href={`tel:+${query.countryCode}${query.phone}`}
              className="text-dashboard-primary hover:underline flex items-center gap-1"
            >
              <Phone size={10} /> +{query.countryCode} {query.phone}
            </a>
          }
        />
        {query.email && (
          <InfoRow
            label="Email"
            value={
              <a href={`mailto:${query.email}`} className="text-dashboard-primary hover:underline flex items-center gap-1">
                <Mail size={10} /> {query.email}
              </a>
            }
          />
        )}
        {query.assignedToName && <InfoRow label="Exec" value={query.assignedToName} />}
        {query.message && (
          <div className="mt-2 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2">
            <p className="text-xs text-dashboard-base-content/50 italic">"{query.message}"</p>
          </div>
        )}
      </SectionCard>

      {j && (
        <SectionCard title="Journey" icon={<MapPin size={14} />}>
          {j.destinations?.length > 0 && (
            <InfoRow label="Destinations" value={
              <div className="flex flex-wrap gap-1">
                {j.destinations.map((d: string) => <Pill key={d} label={d} color="blue" />)}
              </div>
            } />
          )}
          <InfoRow label="From"      value={j.startingPoint} />
          <InfoRow label="Date"      value={
            j.travelDate
              ? new Date(j.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : undefined
          } />
          <InfoRow label="Duration"  value={`${j.noOfDays} Days / ${j.noOfNights} Nights`} />
          <InfoRow label="Date Type" value={j.dateType} />
          <SpecialNote text={j.specialDemands} />
        </SectionCard>
      )}

      {t && (
        <SectionCard title="Travellers" icon={<Users size={14} />}>
          <InfoRow label="Lead"     value={t.leadName} />
          <InfoRow label="Adults"   value={t.adults} />
          {(t.children ?? 0) > 0 && <InfoRow label="Children" value={t.children} />}
          {(t.infants  ?? 0) > 0 && <InfoRow label="Infants"  value={t.infants} />}
          <SpecialNote text={t.specialDemands} />
        </SectionCard>
      )}

      {b && (
        <SectionCard title="Budget" icon={<IndianRupee size={14} />}>
          <InfoRow label="Range"    value={`₹${b.min?.toLocaleString("en-IN")} – ₹${b.max?.toLocaleString("en-IN")}`} />
          <InfoRow label="Type"     value={b.type} />
          <InfoRow label="Currency" value={b.currency} />
          <SpecialNote text={b.specialDemands} />
        </SectionCard>
      )}

      {s && (
        <SectionCard title="Stay Preference" icon={<Hotel size={14} />} defaultOpen={false}>
          {s.types?.length > 0 && (
            <InfoRow label="Types" value={
              <div className="flex flex-wrap gap-1">
                {s.types.map((x: string) => <Pill key={x} label={STAY_LABELS[x] ?? x} color="violet" />)}
              </div>
            } />
          )}
          {s.mealTypes?.length > 0 && (
            <InfoRow label="Meals" value={
              <div className="flex flex-wrap gap-1">
                {s.mealTypes.map((m: string) => (
                  <Pill key={m} label={m === "VEG" ? "🌿 Veg" : "🍗 Non-Veg"} color="green" />
                ))}
              </div>
            } />
          )}
          {s.customMeal && <InfoRow label="Custom" value={s.customMeal} />}
          <SpecialNote text={s.specialDemands} />
        </SectionCard>
      )}

      {tr && (
        <SectionCard title="Transport" icon={<Car size={14} />} defaultOpen={false}>
          {tr.cabTypes?.length > 0 && (
            <InfoRow label="Cabs" value={
              <div className="flex flex-wrap gap-1">
                {tr.cabTypes.map((c: string) => <Pill key={c} label={CAB_LABELS[c] ?? c} color="amber" />)}
              </div>
            } />
          )}
          <InfoRow label="Flights" value={tr.includeFlights ? "Yes" : "No"} />
          <SpecialNote text={tr.specialDemands} />
        </SectionCard>
      )}

      {ac && (
        <SectionCard title="Activities" icon={<Zap size={14} />} defaultOpen={false}>
          <InfoRow label="Activities" value={
            <div className="flex flex-wrap gap-1">
              {ac.selected?.map((a: string) => (
                <Pill key={a} label={ACTIVITY_LABELS[a] ?? a} color="blue" />
              ))}
              {ac.custom?.map((a: string) => (
                <Pill key={a} label={a} />
              ))}
            </div>
          } />
          <SpecialNote text={ac.specialDemands} />
        </SectionCard>
      )}
    </>
  );
}