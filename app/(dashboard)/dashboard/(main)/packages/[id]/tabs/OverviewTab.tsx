"use client";

import { useState, useTransition } from "react";
import { useRouter }  from "next/navigation";
import { Input }    from "../../../components/ui/input";
import { Label }    from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Button }   from "../../../components/ui/button";
import { Switch }   from "../../../components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { ImagePicker, type PickedImage } from "../../../components/dashboard/ImagePicker";
import { Plus, X, Loader2, Info, Tag, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { updatePackageBasic, updatePackageTags, updatePackageCategories, updatePackagePolicies } from "../../actions";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

// ── Types ─────────────────────────────────────────────────────────────────

type Policy  = { id: number; type: string; title: string };
type TagItem = { id: number; name: string; slug: string };
type CatItem = { id: number; name: string; slug: string };

const POLICY_TYPE_LABELS: Record<string, string> = {
  CANCELLATION:         "Cancellation",
  DATE_CHANGE:          "Date Change",
  REFUND:               "Refund",
  TERMS_AND_CONDITIONS: "T&C",
};

// ── Inclusion / Exclusion bullet editor ───────────────────────────────────

function ListEditor({
  label, items, onChange, placeholder,
}: {
  label: string; items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            <span className="flex-1 text-sm">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Generic multi-select for tags / categories / policies ──────────────────

function MultiSelect<T extends { id: number; name: string }>({
  label, all, selected, onChange, renderBadge,
}: {
  label:       string;
  all:         T[];
  selected:    T[];
  onChange:    (items: T[]) => void;
  renderBadge: (item: T) => React.ReactNode;
}) {
  const selectedIds = new Set(selected.map(s => s.id));
  const available   = all.filter(a => !selectedIds.has(a.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[36px] rounded-lg border p-2 bg-background">
        {selected.map(item => (
          <span key={item.id}
            className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {renderBadge(item)}
            <button type="button" onClick={() => onChange(selected.filter(s => s.id !== item.id))}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {available.length > 0 && (
          <Select onValueChange={val => {
            const item = all.find(a => a.id === Number(val));
            if (item) onChange([...selected, item]);
          }}>
            <SelectTrigger className="h-6 w-auto border-0 bg-transparent text-xs text-muted-foreground p-0 focus:ring-0">
              <SelectValue placeholder="+ Add" />
            </SelectTrigger>
            <SelectContent>
              {available.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

// ── Image field with existing preview ─────────────────────────────────────

function ImageField({
  label, hint, existingKey, picks, onChange,
}: {
  label: string; hint: string;
  existingKey: string | null;
  picks: PickedImage[];
  onChange: (p: PickedImage[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {existingKey && picks.length === 0 && (
        <div className="w-32 h-20 rounded-lg overflow-hidden border mb-2">
          <img src={`${BASE}/${existingKey}`} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <ImagePicker
        folder="packages"
        value={picks}
        onChange={onChange}
        maxFiles={1}
        label={`Upload ${label}`}
        hint="JPG, PNG, WebP"
      />
    </div>
  );
}

// ── Main OverviewTab ──────────────────────────────────────────────────────

export function OverviewTab({
  pkg,
  destinations,
  allTags,
  allCategories,
  allPolicies,
  assignedTags,
  assignedCategories,
  assignedPolicies,
}: {
  pkg: {
    id:          number;
    title:       string;
    slug:        string;
    description: string | null;
    meta_title:  string | null;
    meta_desc:   string | null;
    thumbnail:   string | null;
    cover_image: string | null;
    inclusions:  string[];
    exclusions:  string[];
    is_active:   boolean;
    destination: { id: number; name: string };
  };
  destinations:       { id: number; name: string; region: { name: string } }[];
  allTags:            TagItem[];
  allCategories:      CatItem[];
  allPolicies:        Policy[];
  assignedTags:       TagItem[];
  assignedCategories: CatItem[];
  assignedPolicies:   Policy[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title,         setTitle]         = useState(pkg.title);
  const [destinationId, setDestinationId] = useState(String(pkg.destination.id));
  const [description,   setDescription]   = useState(pkg.description ?? "");
  const [metaTitle,     setMetaTitle]     = useState(pkg.meta_title  ?? "");
  const [metaDesc,      setMetaDesc]      = useState(pkg.meta_desc   ?? "");
  const [isActive,      setIsActive]      = useState(pkg.is_active);
  const [inclusions,    setInclusions]    = useState<string[]>(pkg.inclusions);
  const [exclusions,    setExclusions]    = useState<string[]>(pkg.exclusions);
  const [tags,          setTags]          = useState<TagItem[]>(assignedTags);
  const [cats,          setCats]          = useState<CatItem[]>(assignedCategories);
  const [policies,      setPolicies]      = useState<Policy[]>(assignedPolicies);
  const [thumbPicks,    setThumbPicks]    = useState<PickedImage[]>([]);
  const [coverPicks,    setCoverPicks]    = useState<PickedImage[]>([]);

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("title",          title);
      fd.append("slug",           pkg.slug);
      fd.append("destination_id", destinationId);
      fd.append("description",    description);
      fd.append("meta_title",     metaTitle);
      fd.append("meta_desc",      metaDesc);
      fd.append("is_active",      String(isActive));
      fd.append("inclusions",     JSON.stringify(inclusions));
      fd.append("exclusions",     JSON.stringify(exclusions));
      if (thumbPicks[0]?.key) fd.append("thumbnail",   thumbPicks[0].key);
      if (coverPicks[0]?.key) fd.append("cover_image", coverPicks[0].key);

      const [r1, r2, r3, r4] = await Promise.all([
        updatePackageBasic(pkg.id, { success: false, message: "" }, fd),
        updatePackageTags(pkg.id, tags.map(t => t.id)),
        updatePackageCategories(pkg.id, cats.map(c => c.id)),
        updatePackagePolicies(pkg.id, policies.map(p => p.id)),
      ]);

      const failed = [r1, r2, r3, r4].find(r => !r.success);
      if (failed) toast.error(failed.message);
      else { toast.success("Changes saved"); router.refresh(); }
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Basic Info ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" /> Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={pkg.slug} readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Cannot change after creation</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {destinations.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                    <span className="text-muted-foreground text-xs ml-1">({d.region.name})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={4} placeholder="Package overview..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ImageField
              label="Thumbnail"
              hint="Listing cards · 400×250"
              existingKey={pkg.thumbnail}
              picks={thumbPicks}
              onChange={setThumbPicks}
            />
            <ImageField
              label="Cover Image"
              hint="Hero image · 1920×600"
              existingKey={pkg.cover_image}
              picks={coverPicks}
              onChange={setCoverPicks}
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

      {/* ── Inclusions & Exclusions ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Inclusions & Exclusions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <ListEditor
            label="✓ Inclusions"
            items={inclusions}
            onChange={setInclusions}
            placeholder="e.g. Accommodation on twin sharing"
          />
          <ListEditor
            label="✗ Exclusions"
            items={exclusions}
            onChange={setExclusions}
            placeholder="e.g. Airfare and airport taxes"
          />
        </CardContent>
      </Card>

      {/* ── Tags, Categories & Policies ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Tags, Categories & Policies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultiSelect
            label="Tags"
            all={allTags}
            selected={tags}
            onChange={setTags}
            renderBadge={t => t.name}
          />
          <MultiSelect
            label="Categories"
            all={allCategories}
            selected={cats}
            onChange={setCats}
            renderBadge={c => c.name}
          />
          <MultiSelect
            label="Policies"
            all={allPolicies.map(p => ({
              id:   p.id,
              name: `${POLICY_TYPE_LABELS[p.type] ?? p.type}: ${p.title}`,
            }))}
            selected={policies.map(p => ({
              id:   p.id,
              name: `${POLICY_TYPE_LABELS[p.type] ?? p.type}: ${p.title}`,
            }))}
            onChange={selected => {
              const updated = selected
                .map(s => allPolicies.find(p => p.id === s.id))
                .filter((p): p is Policy => p !== undefined);
              setPolicies(updated);
            }}
            renderBadge={p => p.name}
          />
        </CardContent>
      </Card>

      {/* ── SEO ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> SEO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label>Meta Title</Label>
              <span className={`text-xs ${metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaTitle.length}/60
              </span>
            </div>
            <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)}
              placeholder="Kashmir Grand Tour | Dreams Yatri" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label>Meta Description</Label>
              <span className={`text-xs ${metaDesc.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                {metaDesc.length}/160
              </span>
            </div>
            <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} rows={3}
              placeholder="Book Kashmir Grand Tour..." />
          </div>
          {(metaTitle || metaDesc) && (
            <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Preview
              </p>
              <p className="text-xs text-green-700">dreamsyatri.com/packages/{pkg.slug}</p>
              <p className="text-sm text-blue-600 font-medium">{metaTitle || "Page title"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{metaDesc}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            : "Save Changes"
          }
        </Button>
      </div>
    </div>
  );
}