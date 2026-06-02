'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LanguageCode = 'en' | 'hi' | 'gu' | 'mr' | 'bn' | 'ta' | 'te' | 'pa' | 'kn' | 'ml';

export interface Language {
  code: LanguageCode;
  label: string;
  labelEn: string;
  shortCode: string;
  color: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English',   labelEn: 'English',   shortCode: 'En', color: '#2563eb' },
  { code: 'hi', label: 'हिंदी',      labelEn: 'Hindi',     shortCode: 'हि', color: '#dc2626' },
  { code: 'gu', label: 'ગુજરાતી',   labelEn: 'Gujarati',  shortCode: 'ગુ', color: '#d97706' },
  { code: 'mr', label: 'मराठी',      labelEn: 'Marathi',   shortCode: 'म',  color: '#7c3aed' },
  { code: 'bn', label: 'বাংলা',      labelEn: 'Bengali',   shortCode: 'বা', color: '#059669' },
  { code: 'ta', label: 'தமிழ்',      labelEn: 'Tamil',     shortCode: 'த',  color: '#0891b2' },
  { code: 'te', label: 'తెలుగు',    labelEn: 'Telugu',    shortCode: 'తె', color: '#db2777' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ',    labelEn: 'Punjabi',   shortCode: 'ਪੰ', color: '#ea580c' },
  { code: 'kn', label: 'ಕನ್ನಡ',     labelEn: 'Kannada',   shortCode: 'ಕ',  color: '#16a34a' },
  { code: 'ml', label: 'മലയാളം',    labelEn: 'Malayalam', shortCode: 'മ',  color: '#9333ea' },
];

interface LanguageState {
  currentLanguage: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      currentLanguage: 'en',
      setLanguage: (code) => set({ currentLanguage: code }),
    }),
    { name: 'dy-language' }
  )
);
