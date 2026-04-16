"use client";

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import { Input }    from "../../components/ui/input";
import { Label }    from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Button }   from "../../components/ui/button";
import { Switch }   from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Loader2 } from "lucide-react";
import { toast }   from "sonner";
import { createPackage } from "../actions";

type Destination = { id: number; name: string; region: { name: string } };

export function PackageCreateForm({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title,         setTitle]         = useState("");
  const [slug,          setSlug]          = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [description,   setDescription]   = useState("");
  const [isActive,      setIsActive]      = useState(true);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    setSlug(
      val.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !slug || !destinationId) { toast.error("Fill all required fields"); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("title",          title);
      fd.append("slug",           slug);
      fd.append("destination_id", destinationId);
      fd.append("description",    description);
      fd.append("is_active",      String(isActive));

      const result = await createPackage({ success: false, message: "" }, fd);
      if (result.success && result.id) {
        toast.success("Package created — now add durations, pricing and itinerary");
        router.push(`/dashboard/packages/${result.id}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={title}
                onChange={handleTitleChange}
                placeholder="Kashmir Grand Tour"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="kashmir-grand-tour"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destination <span className="text-destructive">*</span></Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {destinations.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    <span className="text-muted-foreground ml-1 text-xs">({d.region.name})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief overview of the package..."
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible on Dreams Yatri</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create & Continue"}
        </Button>
      </div>
    </form>
  );
}