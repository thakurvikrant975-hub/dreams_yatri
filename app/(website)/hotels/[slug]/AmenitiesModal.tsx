"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { AMENITY_ICONS } from "./amenity-icons";

type AmenityGroup = { group: string; items: { label: string; icon: string }[] };

export default function AmenitiesModal({
  hotelName,
  groups,
  open,
  onClose,
}: {
  hotelName: string;
  groups: AmenityGroup[];
  open: boolean;
  onClose: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState(groups[0]?.group ?? "");
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Reset to the first tab every time the modal reopens.
  useEffect(() => {
    if (open) setActiveGroup(groups[0]?.group ?? "");
  }, [open, groups]);

  // Scroll-spy — highlight whichever section is nearest the top of the
  // scrollable content pane, mirroring MMT's tab behavior where the tabs
  // are really just a table of contents for one continuously scrollable list.
  useEffect(() => {
    if (!open) return;
    const root = contentRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const group = (visible[0].target as HTMLElement).dataset.group;
          if (group) setActiveGroup(group);
        }
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );

    for (const g of groups) {
      const el = sectionRefs.current[g.group];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [open, groups]);

  // Keep the active tab scrolled into view within the (possibly overflowing) tab bar.
  useEffect(() => {
    tabRefs.current[activeGroup]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeGroup]);

  function jumpTo(group: string) {
    setActiveGroup(group);
    sectionRefs.current[group]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Amenities at ${hotelName}`}
    >
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-neutral-100 shrink-0">
          <h2 className="text-lg font-bold text-neutral-800">Amenities at {hotelName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-5 px-5 border-b border-neutral-200 overflow-x-auto scrollbar-mini shrink-0">
          {groups.map((g) => (
            <button
              key={g.group}
              ref={(el) => { tabRefs.current[g.group] = el; }}
              type="button"
              onClick={() => jumpTo(g.group)}
              className={
                "shrink-0 whitespace-nowrap py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors " +
                (activeGroup === g.group
                  ? "text-primary-600 border-primary-600"
                  : "text-neutral-400 border-transparent hover:text-neutral-600")
              }
            >
              {g.group}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={contentRef} className="overflow-y-auto px-5 py-4 space-y-6">
          {groups.map((g) => (
            <div
              key={g.group}
              ref={(el) => { sectionRefs.current[g.group] = el; }}
              data-group={g.group}
            >
              <p className="text-sm font-bold text-neutral-800 mb-3">{g.group}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {g.items.map((item) => {
                  const Icon = AMENITY_ICONS[item.icon] ?? CheckCircleIcon;
                  return (
                    <div key={item.label} className="flex items-center gap-2 text-sm text-neutral-700">
                      <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
