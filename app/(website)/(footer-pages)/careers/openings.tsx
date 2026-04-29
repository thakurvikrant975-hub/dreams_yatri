"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mail,
  MapPin,
  Briefcase,
  Clock,
  Plus,
  X,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import Card from "@/app/components/ui/Card";
import { OPENINGS } from "./data";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  index: string;
  title: string;
  department: Department;
  badge: string;
  badgeType: "urgent" | "featured" | "open";
  location: string;
  type: string;
  experience: string;
  openings: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
}

type Department = "Sales" | "Product" | "Growth" | "Operations" | "All";


const DEPARTMENTS: Department[] = ["All", "Sales", "Product", "Growth", "Operations"];

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ type, label }: { type: Job["badgeType"] | "dept"; label: string }) {
  const base =
    "inline-flex items-center font-mono text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full border";

  const variants: Record<string, string> = {
    urgent: "bg-red-50 text-red-600 border-red-200",
    featured: "bg-blue-50 text-blue-600 border-blue-200",
    open: "bg-emerald-50 text-emerald-600 border-emerald-200",
    dept: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return <span className={`${base} ${variants[type]}`}>{label}</span>;
}

// ─── Meta Pill ────────────────────────────────────────────────────────────────
function MetaPill({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-gray-500 font-light">
      <Icon size={11} className="text-gray-500 shrink-0" />
      {text}
    </span>
  );
}

// ─── Animated body height ─────────────────────────────────────────────────────
function AnimatedBody({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) setHeight(open ? ref.current.scrollHeight : 0);
  }, [open]);

  return (
    <div
      style={{ height, overflow: "hidden", transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)" }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({
  job,
  isOpen,
  onToggle,
}: {
  job: Job;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const mailSubject = encodeURIComponent(
    `Application for ${job.title} — Dreams Yatri`
  );

  return (
    <div
      className={[
        "relative border-b border-gray-300 last:border-b-0 transition-colors duration-200",
        isOpen ? "bg-gray-50/70" : "bg-white hover:bg-gray-50/80",
      ].join(" ")}
    >
      {/* Left accent */}
      <div
        className={[
          "absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300",
          isOpen ? "bg-gray-900" : "bg-transparent",
        ].join(" ")}
      />

      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left pl-8 pr-6 py-5 flex items-center gap-5 group"
        aria-expanded={isOpen}
      >
        {/* Index */}
        <span className="font-mono text-[11px] text-gray-800 tabular-nums w-6 shrink-0">
          {job.index}
        </span>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge type={job.badgeType} label={job.badge} />
            <Badge type="dept" label={job.department} />
          </div>

          <h3 className="text-[16px] font-semibold text-gray-900 leading-snug mb-2 group-hover:text-gray-600 transition-colors duration-150">
            {job.title}
          </h3>

          <div className="flex flex-wrap gap-4">
            <MetaPill icon={MapPin} text={job.location} />
            <MetaPill icon={Briefcase} text={job.type} />
            <MetaPill icon={Clock} text={job.experience} />
          </div>
        </div>

        {/* Salary */}
        <span className="hidden sm:block font-mono text-[12px] text-gray-500 text-right shrink-0">
          {job.openings} opening
        </span>

        {/* Toggle */}
        <div
          className={[
            "w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300",
            isOpen
              ? "bg-gray-900 border-gray-900 text-white rotate-0"
              : "bg-white border-gray-200 text-gray-500 group-hover:border-gray-400",
          ].join(" ")}
        >
          {isOpen ? <X size={12} /> : <Plus size={12} />}
        </div>
      </button>

      {/* Body */}
      <AnimatedBody open={isOpen}>
        <div className="pl-[calc(2rem+1.5rem+1.25rem)] pr-6 pb-6">
          <div className="h-px bg-gray-100 mb-5" />

          {/* Description */}
          <p className="text-[13px] font-light text-gray-700 leading-relaxed mb-6 max-w-2xl">
            {job.description}
          </p>

          {/* Two columns */}
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {/* Responsibilities */}
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="font-semibold text-[9px] tracking-[0.2em] uppercase text-gray-700 mb-3">
                What You'll Do
              </p>
              <ul className="space-y-2">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-gray-700 font-light leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Requirements */}
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="font-semibold text-[9px] tracking-[0.2em] uppercase text-gray-700 mb-3">
                What We're Looking For
              </p>
              <ul className="space-y-2">
                {job.requirements.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-gray-700 font-light leading-snug">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-200 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
            <a
              href={`mailto:hr@dreamsyatri.com?subject=${mailSubject}`}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-[12.5px] font-medium px-5 py-2.5 rounded-xl transition-colors duration-150"
            >
              <Mail size={13} />
              Apply for this role
              <ArrowUpRight size={12} className="opacity-60" />
            </a>
            <p className="text-[11px] text-gray-500 font-light">
              Send your CV to{" "}
              <span className="font-medium text-gray-600">hr@dreamsyatri.com</span>
            </p>
          </div>
        </div>
      </AnimatedBody>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export default function Openings() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<Department>("All");

  const toggle = (id: number) =>
    setOpenId((prev) => (prev === id ? null : id));

  const filtered =
    activeFilter === "All"
      ? OPENINGS
      : OPENINGS.filter((j) => j.department === activeFilter);

  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="grid md:grid-cols-2 gap-10 items-start border-b border-gray-900 pb-12 mb-12">
          {/* Left */}
          <div>


            <SectionLabel>Careers at DreamsYatri</SectionLabel>

            <SectionHeading
              text="Find your"
              highlight="Dream Role"
              level="h3"
              highlightPosition="suffix"
              variant="light"
            />
          </div>

          {/* Right */}
          <div className="pt-1">
            <p className="text-[13.5px] font-light text-gray-500 leading-relaxed mb-8 max-w-sm">
              Explore open roles and become part of a team building meaningful
              travel experiences. We review every application personally.
            </p>

            <div className="flex gap-8">
              {[
                { value: String(filtered.length), label: "Open Positions" },
                { value: "Shimla", label: "Headquarters" },
                { value: "< 2 wks", label: "Avg. Time to Offer" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p
                    className="text-[22px] font-medium text-gray-900"
                  >
                    {value}
                  </p>
                  <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-gray-500 mt-1">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="font-mono text-[10px] tracking-wider uppercase text-gray-500 mr-2">
            Filter —
          </span>
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept}
              onClick={() => {
                setActiveFilter(dept);
                setOpenId(null);
              }}
              className={[
                "text-[12px] font-medium px-4 py-1.5 rounded-full border transition-all duration-150",
                activeFilter === dept
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700",
              ].join(" ")}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* ── Job List ── */}
        <Card className="border  rounded-2xl overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-[13px] font-light">
              No openings in this department right now.
            </div>
          ) : (
            filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isOpen={openId === job.id}
                onToggle={() => toggle(job.id)}
              />
            ))
          )}
        </Card>

        {/* ── Bottom note ── */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[12.5px] font-light text-gray-500">
            Don't see the right fit?
          </p>
          <a
            href="mailto:hr@dreamsyatri.com?subject=Open Application — Dreams Yatri"
            className="text-[12.5px] font-medium text-gray-700 border-b border-gray-300 pb-px hover:text-gray-900 hover:border-gray-900 transition-colors duration-150"
          >
            Send an open application →
          </a>
        </div>

      </div>
    </section>
  );
}