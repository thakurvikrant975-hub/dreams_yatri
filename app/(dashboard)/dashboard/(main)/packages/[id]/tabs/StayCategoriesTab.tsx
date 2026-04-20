"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Button }   from "../../../components/ui/button";
import { Badge }    from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { Plus, Trash2, Loader2, Hotel, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { syncPackageStayTypes } from "../../actions";

// ── Types ─────────────────────────────────────────────────────────────────

type AssignedStayType = {
  id:           number;   // package_stay_type_map.id
  stay_type_id: number;
  name:         string;
  slug:         string;
  is_default:   boolean;
  sort_order:   number;
};

type GlobalStayType = {
  id:   number;
  name: string;
  slug: string;
};

// ── Main ──────────────────────────────────────────────────────────────────

export function StayCategoriesTab({
  package_id,
  assignedStayTypes: initial,
  allStayTypes,
}: {
  package_id:        number;
  assignedStayTypes: AssignedStayType[];
  allStayTypes:      GlobalStayType[];
}) {
  const router = useRouter();
  const [assigned,  setAssigned]  = useState<AssignedStayType[]>(initial);
  const [isPending, startTransition] = useTransition();

  const unassigned = allStayTypes.filter(
    st => !assigned.some(a => a.stay_type_id === st.id)
  );

  function addStayType(stay_type_id: number) {
    const st = allStayTypes.find(s => s.id === stay_type_id);
    if (!st) return;
    const newItem: AssignedStayType = {
      id:           0, // temporary — server assigns real id
      stay_type_id: st.id,
      name:         st.name,
      slug:         st.slug,
      is_default:   assigned.length === 0,
      sort_order:   assigned.length,
    };
    const updated = [...assigned, newItem];
    setAssigned(updated);
    save(updated);
  }

  function removeStayType(stay_type_id: number) {
    const updated = assigned
      .filter(a => a.stay_type_id !== stay_type_id)
      .map((a, i) => ({ ...a, sort_order: i, is_default: i === 0 }));
    setAssigned(updated);
    save(updated);
  }

  function setDefault(stay_type_id: number) {
    const updated = assigned.map(a => ({
      ...a,
      is_default: a.stay_type_id === stay_type_id,
    }));
    setAssigned(updated);
    save(updated);
  }

  function save(items: AssignedStayType[]) {
    startTransition(async () => {
      const r = await syncPackageStayTypes(
        package_id,
        items.map(a => a.stay_type_id),
      );
      if (r.success) {
        toast.success(r.message);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Stay Types for this Package</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select which global stay types this package offers. First one becomes the default.
          Pricing and itinerary hotels are set per stay type.
        </p>
      </div>

      {/* Assigned list */}
      {assigned.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Hotel className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No stay types assigned</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add from global stay types below
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assigned
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((st, i) => (
              <div key={st.stay_type_id}
                className="flex items-center gap-3 rounded-xl border p-3 bg-background">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{st.name}</p>
                    {st.is_default && <Badge className="text-[10px] px-1.5 py-0">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">/{st.slug}</p>
                </div>
                {!st.is_default && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    disabled={isPending}
                    onClick={() => setDefault(st.stay_type_id)}
                  >
                    Set Default
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Stay Type</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove <strong>{st.name}</strong> from this package?
                        This will also remove its pricing rows and hotel assignments.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeStayType(st.stay_type_id)}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
        </div>
      )}

      {/* Add from global stay types */}
      {unassigned.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Available to Add
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(st => (
              <Button
                key={st.id}
                type="button"
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={isPending}
                onClick={() => addStayType(st.id)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {st.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {allStayTypes.length === 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
          No global stay types exist yet. Go to{" "}
          <a href="/dashboard/stay-types" className="underline font-medium">
            Stay Types
          </a>{" "}
          to create Standard, Deluxe, Super Deluxe etc. first.
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </div>
      )}
    </div>
  );
}