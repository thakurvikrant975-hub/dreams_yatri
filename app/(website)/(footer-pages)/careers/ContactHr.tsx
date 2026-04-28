"use client"

import React from 'react'
import Image from 'next/image'
import { Reveal } from '../components/Reveal'
import { SectionLabel } from '../components/SectionLabel'
import { SectionHeading } from '../components/SectionHeading'
import { Mail, Phone } from 'lucide-react'

const CONTACTS = [
  {
    href: "mailto:hr@dreamsyatri.com",
    Icon: Mail,
    label: "Email HR",
    value: "hr@dreamsyatri.com",
  },
  {
    href: "tel:+917023907023",
    Icon: Phone,
    label: "Call HR",
    value: "+91 70239 07023",
  },
  {
    href: "tel:+917023907099",
    Icon: Phone,
    label: "Alternate Number",
    value: "+91 70239 07099",
  },
]

const ContactHr = () => {
  return (
    <section className="relative">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative grid lg:grid-cols-2 gap-10 p-8 sm:p-12 items-center">

            {/* LEFT CONTENT */}
            <div>
              <SectionLabel>We're Here to Help</SectionLabel>

              <SectionHeading
                text="Talk to our "
                highlight="HR Team"
                level="h3"
                highlightPosition="suffix"
                variant="light"
              />

              <p
                className="text-gray-600 text-sm leading-relaxed max-w-md mt-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Not sure which role fits you, or want to understand the hiring process better?
                Our HR team is just a message away — we’ll guide you every step of the way.
              </p>

              {/* CONTACT CARDS */}
              <div className="mt-6 flex flex-col gap-3">
                {CONTACTS.map(({ href, Icon, label, value }, i) => (
                  <a
                    key={i}
                    href={href}
                    className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-gray-100
                               bg-white shadow-sm hover:shadow-md hover:border-red-200
                               transition-all duration-300"
                  >
                    {/* ICON */}
                    <span className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center
                                     group-hover:bg-red-500 group-hover:text-white transition-all duration-300">
                      <Icon size={16} />
                    </span>

                    {/* TEXT */}
                    <div>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                        {value}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* RIGHT IMAGE / VISUAL */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-200">

                <Image
                  src="https://images.unsplash.com/photo-1635350736475-c8cef4b21906?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=900&q=80"
                  alt="HR Support"
                  width={500}
                  height={400}
                  className="w-full h-full object-cover shadow-lg"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

                {/* Floating Card */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md rounded-xl p-4 shadow">
                  <p className="text-sm font-semibold text-gray-900">
                    Need quick help?
                  </p>
                  <p className="text-xs text-gray-700">
                    Our HR team usually responds within a few hours.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Reveal>
    </section>
  )
}

export default ContactHr