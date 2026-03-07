"use client"
import { useState } from 'react'
import Button from '../components/ui/Button';
import Image from 'next/image';

const icons = {
  flights: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  ),
  holidays: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <path d="M17 9c0 4-5 11-5 11S7 13 7 9a5 5 0 0 1 10 0z" />
      <circle cx="12" cy="9" r="2" />
      <path d="M3 20h18" />
    </svg>
  ),
  hotels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <rect x="2" y="7" width="20" height="14" rx="1" />
      <path d="M16 21V7a4 4 0 0 0-8 0v14" />
      <path d="M12 3v4" />
      <path d="M2 14h20" />
    </svg>
  ),
  bus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M3 9h18M8 21l1-4M16 21l-1-4M3 13h18" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="16.5" cy="18.5" r="1.5" />
    </svg>
  ),
  train: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <rect x="4" y="3" width="16" height="14" rx="3" />
      <path d="M4 11h16M12 3v8M8 21l2-4M16 21l-2-4" />
      <circle cx="8.5" cy="17.5" r="1.5" />
      <circle cx="15.5" cy="17.5" r="1.5" />
    </svg>
  ),
  cab: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <path d="M5 17H3v-5l2.5-5h11L19 12v5h-2" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M5 12h14M9 7l-1 5M15 7l1 5" />
    </svg>
  ),
  heliride: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <path d="M2 9h20M7 9V5M17 9V5M12 9v10M9 19h6" />
      <ellipse cx="12" cy="5" rx="3" ry="1.5" />
      <path d="M9 13l-3 3M15 13l3 3" />
    </svg>
  ),
  cablecar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <path d="M2 6h20M6 6l2 10h8l2-10" />
      <rect x="8" y="9" width="8" height="6" rx="1" />
      <path d="M10 6V4M14 6V4" />
      <circle cx="10" cy="4" r="1" />
      <circle cx="14" cy="4" r="1" />
    </svg>
  ),
  cruise: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-6">
      <path d="M3 18h18M5 18l-1-6h16l-1 6" />
      <path d="M12 3v9M8 9l4-6 4 6" />
      <path d="M7 12h10" />
    </svg>
  ),
}

type TabKey = 'flights' | 'holidays' | 'hotels' | 'bus' | 'train' | 'cab' | 'heliride' | 'cablecar' | 'cruise'

const tabs: { key: TabKey; label: string; badge?: string }[] = [
  { key: 'flights', label: 'Flights', badge: 'Offer' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'bus', label: 'Bus' },
  { key: 'train', label: 'Train' },
  { key: 'cab', label: 'Cab' },
  { key: 'heliride', label: 'Heli Ride' },
  { key: 'cablecar', label: 'Cable Car', badge: 'New' },
  { key: 'cruise', label: 'Cruise', badge: 'New' },
]

type FieldConfig = { label: string; placeholder: string; type?: string }[]

const fieldMap: Record<TabKey, FieldConfig> = {
  flights: [
    { label: 'Departure From', placeholder: 'City or Airport' },
    { label: 'Going To', placeholder: 'City or Airport' },
    { label: 'Departure Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Going Date', placeholder: 'DD / MM / YYYY', type: 'date' },
  ],
  holidays: [
    { label: 'Destination', placeholder: 'Where do you want to go?' },
    { label: 'Departure From', placeholder: 'Your city' },
    { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Travellers', placeholder: 'Adults, Children' },
  ],
  hotels: [
    { label: 'City / Area', placeholder: 'Where to stay?' },
    { label: 'Check In', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Check Out', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Rooms & Guests', placeholder: '1 Room, 2 Adults' },
  ],
  bus: [
    { label: 'From', placeholder: 'Boarding city' },
    { label: 'To', placeholder: 'Destination city' },
    { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Passengers', placeholder: 'No. of seats' },
  ],
  train: [
    { label: 'From Station', placeholder: 'Origin station' },
    { label: 'To Station', placeholder: 'Destination station' },
    { label: 'Journey Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Class', placeholder: 'Sleeper, 3A, 2A…' },
  ],
  cab: [
    { label: 'Pickup Location', placeholder: 'Enter pickup point' },
    { label: 'Drop Location', placeholder: 'Enter drop point' },
    { label: 'Pickup Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Pickup Time', placeholder: 'HH : MM', type: 'time' },
  ],
  heliride: [
    { label: 'From', placeholder: 'Helipad / location' },
    { label: 'To', placeholder: 'Destination' },
    { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Passengers', placeholder: 'No. of seats' },
  ],
  cablecar: [
    { label: 'Location', placeholder: 'Cable car destination' },
    { label: 'Visit Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Tickets', placeholder: 'No. of tickets' },
    { label: 'Timeslot', placeholder: 'Morning / Evening' },
  ],
  cruise: [
    { label: 'Departure Port', placeholder: 'Port city' },
    { label: 'Destination', placeholder: 'Cruise route' },
    { label: 'Departure Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    { label: 'Guests', placeholder: 'Adults, Children' },
  ],
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>('flights')
  const fields = fieldMap[activeTab]

  return (
    <main>
      <section className="relative min-h-[130 flex flex-col items-center justify-center overflow-hidden px-4 py-16 sm:py-20">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />

        <div className="absolute inset-0 bg-linear-to-b from-neutral-950/40 via-neutral-900/30 to-neutral-950/50" />

         <Image
          src="https://images.unsplash.com/photo-1595815771614-ade9d652a65d?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Hero Image"
          fill
          className="absolute inset-0 object-cover -z-10"
        />

        <div className="relative z-10 text-center mb-8 sm:mb-10 px-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg leading-tight tracking-tight">
            Explore Best Package For Your Tour
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/80 max-w-xl mx-auto leading-relaxed">
            Custom-crafted journeys across India &amp; beyond — powered by travel experts and Avanti AI.
          </p>
        </div>



        <div className="relative z-10 w-full max-w-container px-4 sm:px-6 lg:px-8 mt-16">
          <div className="rounded-2xl bg-white/20 backdrop-blur-[2px] shadow-2xl shadow-black/30  ">

            <div className="flex items-center overflow-x-auto scrollbar-none border-b border-neutral-100  bg-white w-max m-auto -translate-y-1/2 py-4 px-5 rounded-2xl">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex flex-col items-center gap-1 px-3 sm:px-4 py-2.5 min-w-16 sm:min-w-18 text-xs font-medium transition-all rounded-xl shrink-0 ${isActive
                      ? 'bg-red-600 text-white shadow-md shadow-red-300/40'
                      : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                  >

                    {tab.badge && (
                      <span
                        className={`absolute -top-1 -right-1 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none ${tab.badge === 'Offer'
                          ? 'bg-orange-500 text-white'
                          : 'bg-green-500 text-white'
                          }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                    <span className={isActive ? 'text-white' : 'text-neutral-600'}>
                      {icons[tab.key]}
                    </span>
                    <span className="whitespace-nowrap leading-none">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="px-4 sm:px-6 pt-5 ">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {fields.map((field) => (
                  <div key={field.label} className="flex flex-col gap-1.5">
                    <label className="text-xs sm:text-sm font-medium text-inverse pl-1">
                      {field.label}
                    </label>
                    <input
                      type={field.type ?? 'text'}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 placeholder-color shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition"
                    />
                  </div>
                ))}
              </div>


              <div className="flex justify-center mt-6 translate-y-1/2">
                <Button
                  variant="premium"
                  size="lg"
                  className="rounded-full px-12 font-bold text-base shadow-lg shadow-red-400/40 hover:shadow-red-400/60"
                >
                  Search
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
