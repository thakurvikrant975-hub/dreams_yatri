"use client";

import { useState, useRef, useEffect } from "react";
import { signOutHotelOwner } from "@/app/lib/auth-hotel-connect-actions";
import { CaretDown, SignOut, UserCircle } from "@phosphor-icons/react";

export default function UserMenu({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 pl-3 border-l border-neutral-100 cursor-pointer outline-none"
      >
        <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-neutral-700 leading-none">
          {name.split(" ")[0]}
        </span>
        <CaretDown size={12} className="text-neutral-400 hidden sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-neutral-100 bg-white shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-neutral-100">
            <p className="text-sm font-semibold text-neutral-900 leading-none mb-0.5">{name}</p>
            <p className="text-xs text-neutral-500 leading-none">{email}</p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <UserCircle size={15} className="text-neutral-400" />
            Account settings
          </button>
          <div className="border-t border-neutral-100" />
          <form action={signOutHotelOwner}>
            <button
              type="submit"
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <SignOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
