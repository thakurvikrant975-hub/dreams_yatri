"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { createCabOption, updateCabOption, deleteCabOption } from "../../actions";
import { Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";

const CAB_TYPES = [
  "SEDAN", "HATCHBACK", "SUV", "INNOVA", "ERTIGA",
  "WAGON_R", "BOLERO", "TEMPO_TRAVELLER", "MINI_VAN", "BUS",
] as const;

type CabRow = { id: number; package_id: number; cab_type: string; capacity: number; rate_per_day: number | { toNumber(): number } };

type Props = {
  packageId: number;
  initialCabs: CabRow[];
};

type EditState = { cab_type: string; capacity: string; rate_per_day: string };

function toRate(v: number | { toNumber(): number }): number {
  if (typeof v === "number") return v;
  return v.toNumber();
}

export function CabsTab({ packageId, initialCabs }: Props) {
  const [cabs, setCabs] = useState<CabRow[]>(initialCabs);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ cab_type: "SEDAN", capacity: "4", rate_per_day: "" });
  const [newCab, setNewCab] = useState<EditState>({ cab_type: "SEDAN", capacity: "4", rate_per_day: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!newCab.rate_per_day) { setError("Rate per day is required."); return; }
    setError(null);
    startTransition(async () => {
      const record = await createCabOption({
        package_id: packageId,
        cab_type: newCab.cab_type,
        capacity: Number(newCab.capacity),
        rate_per_day: Number(newCab.rate_per_day),
      });
      setCabs((prev) => [...prev, record]);
      setNewCab({ cab_type: "SEDAN", capacity: "4", rate_per_day: "" });
    });
  }

  function startEdit(cab: CabRow) {
    setEditingId(cab.id);
    setEditState({ cab_type: cab.cab_type, capacity: String(cab.capacity), rate_per_day: String(toRate(cab.rate_per_day)) });
  }

  function handleUpdate(id: number) {
    startTransition(async () => {
      await updateCabOption(id, packageId, {
        cab_type: editState.cab_type,
        capacity: Number(editState.capacity),
        rate_per_day: Number(editState.rate_per_day),
      });
      setCabs((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, cab_type: editState.cab_type, capacity: Number(editState.capacity), rate_per_day: Number(editState.rate_per_day) }
            : c
        )
      );
      setEditingId(null);
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteCabOption(id, packageId);
      setCabs((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Cab Options</h2>
        <p className="text-sm text-muted-foreground">Manage cab types and rates for this package.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Add new cab */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <p className="text-sm font-medium">Add Cab Option</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Cab Type</Label>
            <select
              value={newCab.cab_type}
              onChange={(e) => setNewCab((p) => ({ ...p, cab_type: e.target.value }))}
              className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {CAB_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capacity</Label>
            <Input
              type="number"
              min={1}
              value={newCab.capacity}
              onChange={(e) => setNewCab((p) => ({ ...p, capacity: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rate / Day (₹)</Label>
            <Input
              type="number"
              min={0}
              value={newCab.rate_per_day}
              onChange={(e) => setNewCab((p) => ({ ...p, rate_per_day: e.target.value }))}
              placeholder="0"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
          Add
        </Button>
      </div>

      {/* Cabs list */}
      {cabs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No cab options added yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Capacity</th>
                <th className="text-left px-4 py-2 font-medium">Rate / Day</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cabs.map((cab) =>
                editingId === cab.id ? (
                  <tr key={cab.id} className="bg-muted/10">
                    <td className="px-3 py-2">
                      <select
                        value={editState.cab_type}
                        onChange={(e) => setEditState((p) => ({ ...p, cab_type: e.target.value }))}
                        className="h-7 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {CAB_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" value={editState.capacity} onChange={(e) => setEditState((p) => ({ ...p, capacity: e.target.value }))} className="h-7 text-sm w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" value={editState.rate_per_day} onChange={(e) => setEditState((p) => ({ ...p, rate_per_day: e.target.value }))} className="h-7 text-sm w-28" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handleUpdate(cab.id)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={cab.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{cab.cab_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{cab.capacity} pax</td>
                    <td className="px-4 py-2.5">₹{toRate(cab.rate_per_day).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => startEdit(cab)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => handleDelete(cab.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
