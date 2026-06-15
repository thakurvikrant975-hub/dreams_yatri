"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn, formatListItem } from "@/app/lib/utils";
import {
  getTopInclusionExclusion,
  searchInclusionExclusion,
  recordInclusionExclusionUsage,
  type InclusionExclusionSuggestion,
  type InclusionExclusionType,
} from "@/app/actions/packages/inclusion-exclusion.actions";
import { inputCls, AddButton, FieldError } from "./PackageForm";

const VARIANT_STYLES = {
  success: {
    icon: "text-dashboard-success",
    item: "border-dashboard-success/20 bg-dashboard-success/8 text-dashboard-success",
    removeHover: "hover:bg-dashboard-success/20",
    suggestionHover: "hover:bg-dashboard-success/8",
  },
  error: {
    icon: "text-dashboard-error",
    item: "border-dashboard-error/20 bg-dashboard-error/8 text-dashboard-error",
    removeHover: "hover:bg-dashboard-error/20",
    suggestionHover: "hover:bg-dashboard-error/8",
  },
} as const;

type Props = {
  type: InclusionExclusionType;
  label: string;
  Icon: React.ElementType;
  variant: "success" | "error";
  items: string[];
  onItemsChange: (items: string[]) => void;
  error?: string;
  placeholder: string;
};

export function InclusionExclusionField({
  type, label, Icon, variant, items, onItemsChange, error, placeholder,
}: Props) {
  const styles = VARIANT_STYLES[variant];

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<InclusionExclusionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the suggestions dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Fetch suggestions — top 5 most-used when empty, search results when typing
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const query = inputValue.trim();
    const delay = query ? 300 : 0;
    const timer = setTimeout(async () => {
      const results = query
        ? await searchInclusionExclusion(type, query)
        : await getTopInclusionExclusion(type);
      if (!cancelled) {
        setSuggestions(results);
        setLoading(false);
      }
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [inputValue, open, type]);

  function addItem(rawText: string) {
    const formatted = formatListItem(rawText);
    if (!formatted) return;
    setInputValue("");
    setOpen(false);
    if (items.includes(formatted)) return;
    onItemsChange([...items, formatted]);
    void recordInclusionExclusionUsage(type, formatted);
  }

  function removeItem(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  const visibleSuggestions = suggestions.filter((s) => !items.includes(s.text));

  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-dashboard-base-content/75">
        <Icon className={cn("h-3.5 w-3.5", styles.icon)} />
        {label}
      </span>

      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <input
            className={cn(inputCls(!!error), "border border-dashboard-base-content/40")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addItem(inputValue); }
            }}
          />
          <AddButton variant={variant} onClick={() => addItem(inputValue)} />
        </div>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 shadow-lg overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-dashboard-base-content/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading suggestions…
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <p className="py-4 text-center text-xs text-dashboard-base-content/40">
                {inputValue.trim() ? "No matches — press Enter to add" : "No suggestions yet"}
              </p>
            ) : (
              <>
                {!inputValue.trim() && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/40">
                    Most used
                  </p>
                )}
                <ul className="max-h-48 overflow-y-auto">
                  {visibleSuggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => addItem(s.text)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                          styles.suggestionHover,
                        )}
                      >
                        <span className="truncate">{s.text}</span>
                        <span className="shrink-0 text-[10px] text-dashboard-base-content/40">{s.usage_count}×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <FieldError message={error} />

      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", styles.item)}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-xs font-medium">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className={cn("shrink-0 rounded p-0.5 transition-colors", styles.removeHover)}
                aria-label="Remove"
              >
                <X className="h-3 w-3 text-dashboard-base-content" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
