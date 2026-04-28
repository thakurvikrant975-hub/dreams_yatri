"use client";

import { useState, useTransition } from "react";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { updatePackage } from "../../actions";
import { Loader2, Save, Copy } from "lucide-react";

type Props = {
  packageId: number;
  slug: string;
  isActive: boolean;
  usedStayCategories: { id: number; name: string }[];
};

export function AdvancedTab({ packageId, slug, isActive: initialActive, usedStayCategories }: Props) {
  const [isActive, setIsActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updatePackage(packageId, { is_active: isActive });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function copySlug() {
    navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Advanced Settings</h2>
        <p className="text-sm text-muted-foreground">Manage slug, visibility, and associated stay categories.</p>
      </div>

      {/* Slug */}
      <div className="border rounded-lg p-4 space-y-2">
        <Label className="text-sm font-medium">Package Slug</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">{slug}</code>
          <Button type="button" size="sm" variant="ghost" onClick={copySlug}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Slug is auto-generated from the title. Edit the title in the Basic tab to update it.</p>
      </div>

      {/* Visibility */}
      <div className="border rounded-lg p-4 space-y-3">
        <Label className="text-sm font-medium">Visibility</Label>
        <div className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">{isActive ? "Active — visible on site" : "Inactive — hidden from site"}</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
          {saved ? "Saved!" : "Save"}
        </Button>
      </div>

      {/* Used Stay Categories */}
      <div className="border rounded-lg p-4 space-y-3">
        <Label className="text-sm font-medium">Used Stay Categories</Label>
        {usedStayCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stay categories in use yet. Add hotels or pricing to see them here.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {usedStayCategories.map((cat) => (
              <Badge key={cat.id} variant="secondary">{cat.name}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
