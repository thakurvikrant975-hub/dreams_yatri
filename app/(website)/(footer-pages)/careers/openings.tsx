"use client";

import React, { useState, useRef, useEffect } from "react";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { OPENINGS } from "./data";

import {
  CheckCircle,
  ChevronDown,
  Circle,
  Mail,
  MapPin,
  Briefcase,
  Clock,
} from "lucide-react";

function JobCard({
  job,
  isOpen,
  onToggle,
}: {
  job: typeof OPENINGS[0];
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

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200
      ${
        isOpen
          ? "border-red-200 shadow-xl shadow-red-500/[0.06] bg-white"
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full ${job.badgeCls}`}
            >
              {job.badge}
            </span>
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
              {job.department}
            </span>
          </div>

          <h3 className="text-base font-bold text-gray-900 mb-3 pr-4">
            {job.title}
          </h3>

          <div className="flex flex-wrap gap-4">
            {[
              { Icon: MapPin, text: job.location },
              { Icon: Briefcase, text: job.type },
              { Icon: Clock, text: job.experience },
            ].map(({ Icon, text }, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-xs text-gray-400"
              >
                <Icon size={11} className="text-gray-300" />
                {text}
              </span>
            ))}
          </div>
        </div>

        <span
          className={`flex-shrink-0 mt-1 w-8 h-8 rounded-lg border flex items-center justify-center transition-all
          ${
            isOpen
              ? "rotate-180 bg-red-50 border-red-200 text-red-500"
              : "bg-gray-50 border-gray-200 text-gray-400"
          }`}
        >
          <ChevronDown size={15} />
        </span>
      </button>

      {/* Body */}
      <div
        style={{
          height: h,
          overflow: "hidden",
          transition: "height 0.35s cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div ref={bodyRef}>
          <div className="px-6 pb-6 border-t border-gray-100">
            <p className="text-gray-500 text-sm mt-5 mb-6">
              {job.description}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[11px] font-bold uppercase mb-3">
                  What You'll Do
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.responsibilities.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                      <CheckCircle size={14} className="text-red-500 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[11px] font-bold uppercase mb-3">
                  What We're Looking For
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.requirements.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                      <Circle size={13} className="text-red-300 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-gray-100">
              <a
                href={`mailto:hr@dreamsyatri.com?subject=${mailSubject}`}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl"
              >
                <Mail size={14} />
                Apply via Email
              </a>

              <p className="text-xs text-gray-400">
                Send CV to{" "}
                <strong className="text-gray-700">
                  hr@dreamsyatri.com
                </strong>{" "}
                · Subject: <em>"{job.title} — Dreams Yatri"</em>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Openings = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="mb-16">
      <Reveal className="text-center mb-10">
        <SectionLabel>Current Openings</SectionLabel>
        <SectionHeading
          text="Find Your"
          highlight="Dream Role"
          highlightPosition="suffix"
          variant="light"
        />

        <p className="text-gray-400 text-sm">
          To apply, email your CV to{" "}
          <a
            href="mailto:hr@dreamsyatri.com"
            className="text-red-500 font-semibold underline"
          >
            hr@dreamsyatri.com
          </a>
        </p>
      </Reveal>

      <div className="flex flex-col gap-3">
        {OPENINGS.map((job, i) => (
          <Reveal key={job.id} delay={i * 50}>
            <JobCard
              job={job}
              isOpen={openId === job.id}
              onToggle={() => toggle(job.id)}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default Openings;