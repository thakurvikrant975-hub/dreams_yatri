'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLanguage, LANGUAGES } from '@/app/hooks/useLanguage';

interface LanguageDropdownProps {
  isSolid: boolean;
}

export default function LanguageDropdown({ isSolid }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { currentLanguage, setLanguage } = useLanguage();

  const current = LANGUAGES.find(l => l.code === currentLanguage) ?? LANGUAGES[0];

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
        animate={{ color: isSolid ? '#404040' : '#ffffff' }}
        transition={{ duration: 0.3 }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex flex-col items-start gap-0.5 hover:text-red-500 transition-colors outline-none cursor-pointer"
      >
        <span className="text-[10px] leading-none opacity-55 font-medium tracking-wide uppercase">Language</span>
        <span className="flex items-center gap-0.5 font-semibold font-heading leading-tight">
          <span className="text-sm">{current.shortCode}</span>
          <ChevronDownIcon
            className={`size-4 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            aria-label="Select language"
            className="absolute right-0 top-full mt-3 w-[280px] bg-white rounded-2xl shadow-2xl shadow-black/10 border border-neutral-100 overflow-hidden z-[200]"
          >
            {/* Panel header */}
            <div className="px-4 py-3 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-b border-neutral-100 flex items-center gap-2">
              <span className="size-6 rounded-full bg-red-500/10 flex items-center justify-center">
                <GlobeAltIcon className="size-3.5 text-red-500" />
              </span>
              <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
                Select Language
              </p>
            </div>

            {/* Language grid */}
            <div className="p-2.5 grid grid-cols-2 gap-1">
              {LANGUAGES.map((lang) => {
                const active = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    role="option"
                    aria-selected={active}
                    onClick={() => { setLanguage(lang.code); setOpen(false); }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left w-full transition-all duration-150 group ${
                      active
                        ? 'bg-red-50 ring-1 ring-red-200/80'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    {/* Color badge */}
                    <span
                      className="size-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 text-white shadow-sm"
                      style={{ backgroundColor: lang.color }}
                    >
                      {lang.shortCode}
                    </span>

                    {/* Labels */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold leading-tight ${active ? 'text-red-600' : 'text-neutral-800'}`}>
                        {lang.label}
                      </p>
                      <p className="text-[11px] text-neutral-400 leading-tight">{lang.labelEn}</p>
                    </div>

                    {/* Active check */}
                    {active && (
                      <CheckIcon className="size-3.5 text-red-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer note */}
            <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/60">
              <p className="text-[10px] text-neutral-400 text-center">
                Content will be translated to your selected language
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
