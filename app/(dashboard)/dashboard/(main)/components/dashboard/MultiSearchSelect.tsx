"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Loader2, ChevronsUpDown, Check, X, Plus } from "lucide-react";
import { cn } from "@/app/lib/utils";

type Option = {
  id: number;
  label: string;
};

type MultiSearchSelectProps = {
  value: string[];
  onChange: (val: string[]) => void;
  fetchOptions: (query: string) => Promise<Option[]>;
  createOption?: (name: string) => Promise<Option>;
  placeholder?: string;
  disabled?: boolean;
};

export function MultiSearchSelect({
  value,
  onChange,
  fetchOptions,
  createOption,
  placeholder = "Search...",
  disabled = false,
}: MultiSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchRef = useRef(fetchOptions);

  useEffect(() => { fetchRef.current = fetchOptions; });

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setOptions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const delay = query === "" ? 0 : 300;
    const timer = setTimeout(async () => {
      try {
        const results = await fetchRef.current(query);
        if (!cancelled) setOptions(results);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleOption(opt: Option) {
    if (value.includes(opt.label)) {
      onChange(value.filter(v => v !== opt.label));
    } else {
      onChange([...value, opt.label]);
    }
  }

  function removeValue(e: React.MouseEvent, name: string) {
    e.stopPropagation();
    onChange(value.filter(v => v !== name));
  }

  async function handleCreate() {
    if (!createOption || !query.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createOption(query.trim());
      onChange([...value, created.label]);
      setQuery("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const trimmedQuery = query.trim();
  const canCreate =
    !!createOption &&
    trimmedQuery.length > 0 &&
    !loading &&
    !options.some((o) => o.label.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !value.some((v) => v.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(name => (
            <Badge key={name} variant="secondary" className="gap-1 pr-1 text-xs font-normal rounded-md">
              {name}
              <button
                type="button"
                onClick={e => removeValue(e, name)}
                className="ml-0.5 rounded p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(prev => !prev)}
          className="w-full justify-between font-normal h-9 text-sm"
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {value.length > 0 ? `${value.length} selected` : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
            <div className="p-1.5 border-b">
              <Input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to search..."
                className="h-8 text-sm"
              />
            </div>

            <div className="max-h-52 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center py-5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : options.length === 0 && !canCreate ? (
                <p className="text-xs text-muted-foreground text-center py-5">
                  {query ? "No results found" : "Start typing to search"}
                </p>
              ) : (
                options.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted text-left",
                      value.includes(opt.label) && "bg-muted"
                    )}
                  >
                    <Check className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value.includes(opt.label) ? "opacity-100" : "opacity-0"
                    )} />
                    <span className="font-medium leading-tight truncate">{opt.label}</span>
                  </button>
                ))
              )}
            </div>

            {canCreate && (
              <div className="border-t p-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-primary/10 text-primary text-left"
                >
                  {creating
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : <Plus className="h-3.5 w-3.5 shrink-0" />}
                  <span className="font-medium">Create &quot;{trimmedQuery}&quot;</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
