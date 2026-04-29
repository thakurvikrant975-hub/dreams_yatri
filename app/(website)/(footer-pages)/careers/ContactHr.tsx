"use client"

import React from 'react'
import { Reveal } from '../components/Reveal'
import Card from '@/app/components/ui/Card'
import { CONTACTS } from './data'
import { SectionHeading } from '../components/SectionHeading'
import { SectionLabel } from '../components/SectionLabel'


const ArrowIcon = () => (
  <svg className="ml-auto opacity-35 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M17 7H7M17 7v10" />
  </svg>
)

const ContactHr = () => {
  return (
    <section>
      <Reveal>
        <Card className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <div className="grid lg:grid-cols-2">

            {/* LEFT — Contact Panel */}
            <div className="p-8 sm:p-10 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-100">

              {/* Label */}
  

                      <SectionLabel>Careers Support</SectionLabel>
                      <SectionHeading
                        text="Speak directly with "
                        highlight="HR Team"
                        highlightPosition="suffix"
                        variant="light"
                        level='h3'
                      />

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed max-w-sm mb-7">
                Whether you have questions about open roles, the hiring process, or company culture — our HR team is available and responsive.
              </p>

              {/* Contact Items */}
              <div className="flex flex-col gap-2.5">
                {CONTACTS.map(({ href, label, value, icon }, i) => {
                  const Icon = icon;

                  return (
                    <a
                      key={i}
                      href={href}
                      className="group flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50 hover:border-red-100 hover:bg-red-50/30 transition-all duration-200"
                    >
                      <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0 group-hover:bg-red-500 group-hover:text-white transition-all duration-200">
                        <Icon size={18} />
                      </span>

                      <div>
                        <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-red-600 transition-colors">
                          {value}
                        </p>
                      </div>

                      <ArrowIcon />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* RIGHT — Info Panel */}
            <div className="p-8 sm:p-10 bg-gray-50 flex flex-col gap-4">

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-gray-100 bg-white">
                  <p className="text-xl font-medium text-gray-900 mb-0.5">&lt; 2 hrs</p>
                  <p className="text-[11px] text-gray-400">Avg. response time</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-100 bg-white">
                  <p className="text-xl font-medium text-gray-900 mb-0.5">Mon–Sat</p>
                  <p className="text-[11px] text-gray-400">Availability</p>
                </div>
              </div>

              {/* HR Profile Card */}
              <div className="flex-1 p-5 rounded-xl border border-gray-100 bg-white flex flex-col justify-between gap-4">

                {/* Avatar + Status */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-sm font-medium text-red-700 shrink-0">
                    DY
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dreams Yatri HR</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                      <span className="text-[11px] text-gray-400">Available now</span>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    "We're always happy to help with queries about open positions, interview schedules, or company onboarding."
                  </p>
                </div>

                {/* Tags */}
                <div className="flex gap-2 flex-wrap">
                  {["Hiring", "Onboarding", "Culture"].map((tag) => (
                    <span key={tag} className="text-[11px] px-3 py-1 rounded-full border border-gray-200 text-gray-500 bg-gray-50">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="border-t border-gray-100 px-8 sm:px-10 py-3.5 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Dreams Yatri (OPC) Private Limited — Shimla, Himachal Pradesh
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
              <span className="text-xs text-gray-400">Confidential communications</span>
            </div>
          </div>
        </Card>
      </Reveal>
    </section>
  )
}

export default ContactHr;