"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { updatePackageAction } from "@/app/actions/packages/package.actions";
import type { PackageWithRelations } from "@/app/types/packages";

type Props = {
  packageId: number;
  inclusions: string[];
  exclusions: string[];
  pkg: PackageWithRelations;
};

export function AdvancedTab({ packageId, inclusions: initInc, exclusions: initExc, pkg }: Props) {
  const [isPending, startTransition] = useTransition();
  const [inclusions, setInclusions] = useState<string[]>(initInc.length > 0 ? initInc : [""]);
  const [exclusions, setExclusions] = useState<string[]>(initExc.length > 0 ? initExc : [""]);

  function addItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, ""]);
  }

  function removeItem(list: string[], setList: (v: string[]) => void, idx: number) {
    if (list.length <= 1) return setList([""]);
    setList(list.filter((_, i) => i !== idx));
  }

  function updateItem(list: string[], setList: (v: string[]) => void, idx: number, val: string) {
    const next = [...list];
    next[idx] = val;
    setList(next);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updatePackageAction(packageId, {
        title: pkg.title,
        slug: pkg.slug,
        destination_id: pkg.destination.id,
        inclusions: inclusions.filter(Boolean),
        exclusions: exclusions.filter(Boolean),
      });
      if (res.success) toast.success("Saved");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inclusions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inclusions.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                onChange={e => updateItem(inclusions, setInclusions, i, e.target.value)}
                placeholder={`e.g. Accommodation on twin sharing basis`}
              />
              <Button
                variant="ghost" size="icon"
                onClick={() => removeItem(inclusions, setInclusions, i)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem(inclusions, setInclusions)}>
            <Plus className="h-4 w-4 mr-1" /> Add Inclusion
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exclusions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {exclusions.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={item}
                onChange={e => updateItem(exclusions, setExclusions, i, e.target.value)}
                placeholder={`e.g. Airfare / train tickets`}
              />
              <Button
                variant="ghost" size="icon"
                onClick={() => removeItem(exclusions, setExclusions, i)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem(exclusions, setExclusions)}>
            <Plus className="h-4 w-4 mr-1" /> Add Exclusion
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
