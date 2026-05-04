"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Package, Loader2, Plus, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { toast } from "sonner";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { createPackageAction, getDestinationsForSelectAction } from "@/app/actions/packages/package.actions";
import { useEffect } from "react";

type Destination = { id: number; name: string; slug: string; region: { name: string } };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function NewPackagePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [destinations, setDestinations] = useState<Destination[]>([]);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [destinationId, setDestinationId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [inclusions, setInclusions] = useState<string[]>([""]);
  const [exclusions, setExclusions] = useState<string[]>([""]);

  useEffect(() => {
    getDestinationsForSelectAction().then(setDestinations);
  }, []);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function addItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, ""]);
  }

  function removeItem(list: string[], setList: (v: string[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  function updateItem(list: string[], setList: (v: string[]) => void, idx: number, val: string) {
    const next = [...list];
    next[idx] = val;
    setList(next);
  }

  function handleSubmit() {
    if (!title.trim()) return toast.error("Title is required");
    if (!slug.trim()) return toast.error("Slug is required");
    if (!destinationId) return toast.error("Destination is required");

    startTransition(async () => {
      const res = await createPackageAction({
        title: title.trim(),
        slug: slug.trim(),
        destination_id: Number(destinationId),
        description: description.trim() || undefined,
        is_active: isActive,
        inclusions: inclusions.filter(Boolean),
        exclusions: exclusions.filter(Boolean),
        tag_ids: [],
        category_ids: [],
        policy_ids: [],
      });

      if (res.success) {
        toast.success("Package created");
        router.push(`/dashboard/packages/${res.data.id}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6 ">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink href="/dashboard/packages">Packages</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>New Package</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/packages"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">New Package</h1>
          <p className="text-sm text-muted-foreground">Create a travel package</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. Kashmir Valley Explorer"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Slug <span className="text-destructive">*</span></Label>
            <Input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="kashmir-valley-explorer"
            />
            <p className="text-xs text-muted-foreground">Used in URLs · lowercase letters, numbers, and hyphens</p>
          </div>

          <div className="space-y-1.5">
            <Label>Destination <span className="text-destructive">*</span></Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name} {d.region ? `· ${d.region.name}` : ""}
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
              rows={4}
              placeholder="Brief description of the package..."
            />
          </div>
        </CardContent>
      </Card>

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
                placeholder={`Inclusion ${i + 1}`}
              />
              <Button
                variant="ghost" size="icon"
                onClick={() => removeItem(inclusions, setInclusions, i)}
                disabled={inclusions.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            onClick={() => addItem(inclusions, setInclusions)}
          >
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
                placeholder={`Exclusion ${i + 1}`}
              />
              <Button
                variant="ghost" size="icon"
                onClick={() => removeItem(exclusions, setExclusions, i)}
                disabled={exclusions.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            onClick={() => addItem(exclusions, setExclusions)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Exclusion
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible to customers</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/packages">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create Package"}
        </Button>
      </div>
    </div>
  );
}
