"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Search, Loader2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { ImageDropField } from "../../(builder)/package-builder/[packageId]/ImageDropField";
import {
  searchCatalogPackages, addItemFromCatalog, addCustomItem, updateItem, removeItem, reorderItems,
  type CatalogPackageResult,
} from "./actions";

export type LandingPageItemRow = {
  id: string;
  packageId: number | null;
  title: string;
  imageUrl: string;
  routeLabel: string | null;
  priceLabel: string | null;
  badgeLabel: string | null;
  showInHero: boolean;
  sortOrder: number;
};

const MAX_HERO_ITEMS = 4;

export function PackageItemsEditor({ landingPageId, initialItems }: { landingPageId: string; initialItems: LandingPageItemRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogPackageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ title: "", imageUrl: "", routeLabel: "", priceLabel: "", badgeLabel: "" });

  function onSearchChange(v: string) {
    setQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!v.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchCatalogPackages(v));
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleAddFromCatalog(pkg: CatalogPackageResult) {
    startTransition(async () => {
      const result = await addItemFromCatalog(landingPageId, pkg.id);
      if (!result.success) { toast.error(result.message); return; }
      setItems((prev) => [
        ...prev,
        { id: result.data.id, packageId: pkg.id, title: pkg.title, imageUrl: pkg.thumbnail ?? "", routeLabel: null, priceLabel: null, badgeLabel: null, showInHero: false, sortOrder: prev.length },
      ]);
      toast.success("Package added — fill in route/price below if needed");
    });
  }

  function handleAddCustom() {
    if (!custom.title.trim() || !custom.imageUrl) {
      toast.error("Title and image are required.");
      return;
    }
    startTransition(async () => {
      const result = await addCustomItem(landingPageId, custom);
      if (!result.success) { toast.error(result.message); return; }
      setItems((prev) => [
        ...prev,
        { id: result.data.id, packageId: null, title: custom.title, imageUrl: custom.imageUrl, routeLabel: custom.routeLabel || null, priceLabel: custom.priceLabel || null, badgeLabel: custom.badgeLabel || null, showInHero: false, sortOrder: prev.length },
      ]);
      setCustom({ title: "", imageUrl: "", routeLabel: "", priceLabel: "", badgeLabel: "" });
      setCustomOpen(false);
      toast.success("Package card added");
    });
  }

  function patchLocal(id: string, patch: Partial<LandingPageItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function handleFieldSave(id: string, patch: Partial<LandingPageItemRow>) {
    patchLocal(id, patch);
    startTransition(async () => {
      const result = await updateItem(id, patch);
      if (!result.success) toast.error(result.message);
    });
  }

  function handleToggleHero(item: LandingPageItemRow) {
    const heroCount = items.filter((it) => it.showInHero).length;
    if (!item.showInHero && heroCount >= MAX_HERO_ITEMS) {
      toast.error(`Only up to ${MAX_HERO_ITEMS} package cards can appear in the hero rail.`);
      return;
    }
    handleFieldSave(item.id, { showInHero: !item.showInHero });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeItem(id);
      if (!result.success) { toast.error(result.message); return; }
      setItems((prev) => prev.filter((it) => it.id !== id));
    });
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderItems(landingPageId, next.map((it) => it.id));
      if (!result.success) toast.error(result.message);
    });
  }

  return (
    <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-dashboard-base-content">Packages</h2>
        <span className="text-xs text-dashboard-base-content/50">{items.filter((i) => i.showInHero).length}/{MAX_HERO_ITEMS} in hero rail</span>
      </div>

      {/* Catalog search */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-dashboard-base-content/90">Add from your package catalog</label>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dashboard-base-content/40" />
          <Input value={query} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search packages by title…" className="pl-8" />
        </div>
        {searching && <p className="text-xs text-dashboard-base-content/50">Searching…</p>}
        {results.length > 0 && (
          <div className="rounded-lg border border-dashboard-base-300 divide-y divide-dashboard-base-300 max-h-56 overflow-y-auto">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbnail || "/placeholder.svg"} alt="" className="size-9 rounded-md object-cover bg-dashboard-base-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dashboard-base-content truncate">{r.title}</p>
                  {r.destinationName && <p className="text-xs text-dashboard-base-content/50">{r.destinationName}</p>}
                </div>
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleAddFromCatalog(r)}>Add</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom item */}
      {customOpen ? (
        <div className="rounded-xl border border-dashboard-base-300 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-dashboard-base-content/70">Custom package card</p>
          <ImageDropField value={custom.imageUrl} onChange={(url) => setCustom((c) => ({ ...c, imageUrl: url }))} folder="landing-pages" />
          <Input value={custom.title} onChange={(e) => setCustom((c) => ({ ...c, title: e.target.value }))} placeholder="Title, e.g. Andaman Scuba Diving Adventure" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={custom.routeLabel} onChange={(e) => setCustom((c) => ({ ...c, routeLabel: e.target.value }))} placeholder="Route, e.g. 5D / 4N" />
            <Input value={custom.priceLabel} onChange={(e) => setCustom((c) => ({ ...c, priceLabel: e.target.value }))} placeholder="Price, e.g. ₹16,999/person" />
          </div>
          <Input value={custom.badgeLabel} onChange={(e) => setCustom((c) => ({ ...c, badgeLabel: e.target.value }))} placeholder="Badge (optional), e.g. Best Seller" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={isPending} onClick={handleAddCustom}>
              {isPending ? <Loader2 size={14} className="animate-spin" /> : "Add card"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCustomOpen(true)}>
          <Plus size={14} /> Add custom package card
        </Button>
      )}

      {/* Current items */}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-dashboard-base-content/50">No packages added yet.</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 rounded-xl border border-dashboard-base-300 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl || "/placeholder.svg"} alt="" className="size-14 rounded-md object-cover bg-dashboard-base-200 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Input value={item.title} onChange={(e) => patchLocal(item.id, { title: e.target.value })} onBlur={() => handleFieldSave(item.id, { title: item.title })} className="h-8 text-sm font-medium" />
              <div className="grid grid-cols-3 gap-1.5">
                <Input value={item.routeLabel ?? ""} onChange={(e) => patchLocal(item.id, { routeLabel: e.target.value })} onBlur={() => handleFieldSave(item.id, { routeLabel: item.routeLabel })} placeholder="Route" className="h-8 text-xs" />
                <Input value={item.priceLabel ?? ""} onChange={(e) => patchLocal(item.id, { priceLabel: e.target.value })} onBlur={() => handleFieldSave(item.id, { priceLabel: item.priceLabel })} placeholder="Price" className="h-8 text-xs" />
                <Input value={item.badgeLabel ?? ""} onChange={(e) => patchLocal(item.id, { badgeLabel: e.target.value })} onBlur={() => handleFieldSave(item.id, { badgeLabel: item.badgeLabel })} placeholder="Badge" className="h-8 text-xs" />
              </div>
              <Checkbox checked={item.showInHero} onChange={() => handleToggleHero(item)} label={<span className="text-xs">Show in hero rail</span>} />
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30 text-dashboard-base-content/60 hover:text-dashboard-base-content"><ChevronUp size={16} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="disabled:opacity-30 text-dashboard-base-content/60 hover:text-dashboard-base-content"><ChevronDown size={16} /></button>
              <button type="button" onClick={() => handleRemove(item.id)} className="text-red-600 hover:text-red-700 mt-1"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
