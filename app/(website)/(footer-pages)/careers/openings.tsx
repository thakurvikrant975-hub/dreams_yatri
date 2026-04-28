"use client";

import { useState, useRef, useEffect } from "react";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { OPENINGS } from "./data";
import {
  CheckCircle,
  Circle,
  Mail,
  MapPin,
  Briefcase,
  Clock,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";

// ─── Department color map ─────────────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
  Sales:      "bg-orange-50 text-orange-600 border-orange-200",
  Product:    "bg-sky-50 text-sky-600 border-sky-200",
  Growth:     "bg-violet-50 text-violet-600 border-violet-200",
  Operations: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

// ─── JobCard ──────────────────────────────────────────────────────────────────
function JobCard({
  job,
  index,
  isOpen,
  onToggle,
}: {
  job: (typeof OPENINGS)[0];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (bodyRef.current) {
      setH(isOpen ? bodyRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  const mailSubject = encodeURIComponent(
    `Application for ${job.title} — Dreams Yatri`
  );

  const deptCls =
    DEPT_COLORS[job.department] ?? "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <div
      className={`
        relative rounded-2xl border transition-all duration-300 overflow-hidden
        ${isOpen
          ? "border-red-200 shadow-lg shadow-red-500/[0.07] bg-white"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
        }
      `}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl transition-all duration-300
          ${isOpen ? "bg-red-500" : "bg-transparent group-hover:bg-gray-200"}`}
      />

      {/* ── HEADER BUTTON ── */}
      <button
        onClick={onToggle}
        className="group w-full text-left pl-8 pr-6 py-6 flex items-start justify-between gap-6"
      >
        <div className="flex-1 min-w-0">

          {/* Index + Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Serial number */}
            <span
              className="text-[10px] font-semibold text-gray-300 tabular-nums mr-1"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            {/* Urgency badge */}
            <span className={`text-[10px] font-bold tracking-wide px-2.5 py-0.5 rounded-full border ${job.badgeCls}`}>
              {job.badge}
            </span>

            {/* Department badge */}
            <span className={`text-[10px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full border ${deptCls}`}>
              {job.department}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-[17px] font-bold text-gray-900 leading-snug mb-3 group-hover:text-red-600 transition-colors duration-200"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {job.title}
          </h3>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-4">
            {[
              { Icon: MapPin,   text: job.location   },
              { Icon: Briefcase, text: job.type      },
              { Icon: Clock,    text: job.experience },
            ].map(({ Icon, text }, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[12px] text-gray-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Icon size={11} className="text-gray-300" />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Toggle chevron */}
        <div
          className={`
            mt-1 w-8 h-8 rounded-xl flex items-center justify-center shrink-0
            border transition-all duration-300
            ${isOpen
              ? "bg-red-500 border-red-500 text-white rotate-90"
              : "bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300 group-hover:bg-gray-100"
            }
          `}
        >
          <ChevronRight size={15} />
        </div>
      </button>

      {/* ── EXPANDABLE BODY ── */}
      <div
        style={{
          height: h,
          overflow: "hidden",
          transition: "height 0.4s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div ref={bodyRef}>
          <div className="pl-8 pr-6 pb-7">

            {/* Divider */}
            <div className="w-full h-px bg-gray-100 mb-6" />

            {/* Description */}
            <p
              className="text-[13.5px] text-gray-500 leading-relaxed mb-7 max-w-2xl"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {job.description}
            </p>

            {/* Two-column list grid */}
            <div className="grid md:grid-cols-2 gap-4 mb-7">

              {/* What You'll Do */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-5">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  What You'll Do
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.responsibilities.map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[12.5px] text-gray-600 leading-snug"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      <CheckCircle
                        size={13}
                        className="text-red-400 mt-0.5 shrink-0"
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What We're Looking For */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-5">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  What We're Looking For
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.requirements.map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[12.5px] text-gray-600 leading-snug"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      <Circle
                        size={12}
                        className="text-gray-300 mt-0.5 shrink-0"
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-5 border-t border-gray-100">
              <a
                href={`mailto:hr@dreamsyatri.com?subject=${mailSubject}`}
                className="
                  inline-flex items-center gap-2
                  bg-red-500 hover:bg-red-600
                  text-white text-[13px] font-semibold
                  px-5 py-2.5 rounded-xl
                  shadow-sm hover:shadow-md
                  transition-all duration-200
                "
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Mail size={14} />
                Apply for this role
                <ArrowUpRight size={13} className="opacity-70" />
              </a>

              <p
                className="text-[11.5px] text-gray-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Send your CV to{" "}
                <span className="font-semibold text-gray-600">
                  hr@dreamsyatri.com
                </span>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
const Openings = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) =>
    setOpenId((prev) => (prev === id ? null : id));

  return (
    <section className="py-24">
      <div className="max-w-8xl mx-auto">

        {/* ── Header ── */}
        <Reveal className="text-center mb-14">
          <SectionLabel>Careers at Dreams Yatri</SectionLabel>

          <SectionHeading
            text="Find Your "
            highlight="Dream Role"
            highlightPosition="suffix"
            variant="light"
          />

          <p
            className="text-gray-400 text-[13.5px] mt-4 max-w-lg mx-auto leading-relaxed"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Explore open roles and become part of a team building meaningful
            travel experiences. We review every application personally.
          </p>
        </Reveal>

        {/* ── Stats row ── */}
        <Reveal>
          <div className="flex flex-wrap justify-center gap-8 mb-12 pb-10 border-b border-gray-100">
            {[
              { value: `${OPENINGS.length}`, label: "Open Positions" },
              { value: "Shimla", label: "Headquarters" },
              { value: "Fast", label: "Hiring Process" },
            ].map(({ value, label }, i) => (
              <div key={i} className="text-center">
                <p
                  className="text-2xl font-bold text-gray-900"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {value}
                </p>
                <p
                  className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ── Job cards ── */}
        <div className="flex flex-col gap-3">
          {OPENINGS.map((job, i) => (
            <Reveal key={job.id} delay={i * 60}>
              <JobCard
                job={job}
                index={i}
                isOpen={openId === job.id}
                onToggle={() => toggle(job.id)}
              />
            </Reveal>
          ))}
        </div>

        {/* ── Bottom note ── */}
        <Reveal>
          <div className="mt-10 text-center">
            <p
              className="text-[12px] text-gray-400 leading-relaxed"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Don't see a fit?{" "}
              <a
                href="mailto:hr@dreamsyatri.com?subject=Open Application — Dreams Yatri"
                className="text-red-500 font-semibold hover:text-red-600 transition-colors"
              >
                Send an open application
              </a>{" "}
              — we're always looking for exceptional people.
            </p>
          </div>
        </Reveal>

      </div>
    </section>
  );
};

export default Openings;