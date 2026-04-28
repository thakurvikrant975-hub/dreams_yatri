"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { SearchSelect } from "../../components/dashboard/SearchSelect";
import { ImageUpload, type UploadedImage } from "../../components/dashboard/ImageUpload";
import { createPackage, updatePackage, searchDestinations } from "../actions";
import { Loader2 } from "lucide-react";

type PackageRow = {
  id: number;
  title: string;
  destination_id: number;
  description: string | null;
  thumbnail: string | null;
  cover_image: string | null;
  is_active: boolean;
};

type Props = {
  initial?: PackageRow;
  destinationLabel?: string;
};

export function PackageForm({ initial, destinationLabel = "" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [destinationId, setDestinationId] = useState<number | null>(initial?.destination_id ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [thumbnail, setThumbnail] = useState<UploadedImage | null>(
    initial?.thumbnail ? { key: initial.thumbnail, url: initial.thumbnail } : null
  );
  const [coverImage, setCoverImage] = useState<UploadedImage | null>(
    initial?.cover_image ? { key: initial.cover_image, url: initial.cover_image } : null
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!destinationId) { setError("Destination is required"); return; }
    setError(null);

    startTransition(async () => {
      try {
        if (initial) {
          await updatePackage(initial.id, {
            title: title.trim(),
            destination_id: destinationId,
            description: description.trim() || undefined,
            thumbnail: thumbnail?.key,
            cover_image: coverImage?.key,
            is_active: isActive,
          });
        } else {
          const pkg = await createPackage({
            title: title.trim(),
            destination_id: destinationId,
            description: description.trim() || undefined,
            thumbnail: thumbnail?.key,
            cover_image: coverImage?.key,
            is_active: isActive,
          });
          router.push(`/dashboard/packages/${pkg.id}`);
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Package Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Manali Adventure Tour"
          />
        </div>

        <div className="space-y-2">
          <Label>Destination *</Label>
          <SearchSelect
            value={destinationId}
            onChange={(val) => setDestinationId(val)}
            fetchOptions={searchDestinations}
            placeholder="Search destination..."
            initialLabel={destinationLabel}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief package description..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Thumbnail</Label>
          <ImageUpload
            name="thumbnail"
            label="Upload Thumbnail"
            value={thumbnail}
            onChange={setThumbnail}
            folder="packages"
            aspectRatio="video"
          />
        </div>
        <div className="space-y-2">
          <Label>Cover Image</Label>
          <ImageUpload
            name="cover_image"
            label="Upload Cover Image"
            value={coverImage}
            onChange={setCoverImage}
            folder="packages"
            aspectRatio="wide"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is_active"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
        <Label htmlFor="is_active">Active (visible on site)</Label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initial ? "Save Changes" : "Create Package"}
        </Button>
        {initial && (
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
