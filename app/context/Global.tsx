// app/context/Global.tsx
"use client";

import { createContext, useContext } from "react";
import { SITE_CONFIG } from "../lib/seo/site-config";

type GlobalContextType = {
  contact: typeof SITE_CONFIG.contact;
  social: typeof SITE_CONFIG.social;
  stats: typeof SITE_CONFIG.stats;
  address: typeof SITE_CONFIG.address;
};

const GlobalContext = createContext<GlobalContextType | null>(null);

export const GlobalProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalContext.Provider
      value={{
        contact: SITE_CONFIG.contact,
        social: SITE_CONFIG.social,
        stats: SITE_CONFIG.stats,
        address: SITE_CONFIG.address,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = () => {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal must be used inside GlobalProvider");
  return ctx;
};

// Scoped hooks for cleaner imports
export const useContact = () => useGlobal().contact;
export const useSocial = () => useGlobal().social;
export const useStats = () => useGlobal().stats;