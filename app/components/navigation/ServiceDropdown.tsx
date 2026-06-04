'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Map, Heart, Users, Briefcase, FileText, Hotel, Plane } from 'lucide-react';
import Link from 'next/link';

interface ServiceItem {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

const SERVICES: ServiceItem[] = [
  { label: 'Tour Packages',    description: 'Curated domestic & international tours',  href: '/packages',    icon: Map },
  { label: 'Honeymoon Tours',  description: 'Romantic getaways for couples',            href: '/honeymoon',   icon: Heart },
  { label: 'Group Tours',      description: 'Fun trips with family & friends',          href: '/group-tours', icon: Users },
  { label: 'Corporate Travel', description: 'Seamless business travel solutions',       href: '/corporate',   icon: Briefcase },
  { label: 'Visa Assistance',  description: 'Hassle-free visa processing support',      href: '/visa',        icon: FileText },
  { label: 'Hotel Booking',    description: 'Handpicked stays at the best prices',      href: '/hotels',      icon: Hotel },
];

interface ServiceDropdownProps {
  isSolid: boolean;
}

export default function ServiceDropdown({ isSolid }: ServiceDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        animate={{ color: isSolid ? '#171717' : '#ffffff' }}
        transition={{ duration: 0.3 }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 font-semibold hover:text-red-500 transition-colors font-heading outline-none cursor-pointer"
      >
        Services
        <ChevronDown
          className={`size-6 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            aria-label="Services"
            className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-neutral-100 overflow-hidden z-50"
          >
            {/* Panel header */}
            <div className="px-4 py-3 bg-linear-to-r from-red-50 via-orange-50 to-amber-50 border-b border-neutral-100 flex items-center gap-2">
              <span className="size-6 rounded-full bg-red-500/10 flex items-center justify-center">
                <Plane className="size-3.5 text-red-500" />
              </span>
              <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
                Our Services
              </p>
            </div>

            {/* Service list */}
            <div className="p-2">
              {SERVICES.map((service) => {
                const Icon = service.icon;
                return (
                <Link
                  key={service.href}
                  href={service.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition-all duration-150 group cursor-pointer"
                >
                  <span className="size-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                    <Icon className="size-4.5 text-red-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-neutral-800 leading-tight">
                      {service.label}
                    </p>
                    <p className="text-[11px] text-neutral-400 leading-tight">{service.description}</p>
                  </div>
                </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
