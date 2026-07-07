"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ImageIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  StarIcon,
  MagnifyingGlassIcon,
  TagIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import {
  uploadHotelPhotos,
  setCoverPhoto,
  savePhotoTags,
  deleteHotelPhoto,
  proceedPhotos,
  type HotelPhoto,
  type PhotoCategory,
} from "./photo-actions";

// ── Tag data ──────────────────────────────────────────────────────────────────

const HOTEL_PHOTO_TAGS = [
  "Swimming Pool", "Lobby", "Reception", "Restaurant", "Bar", "Lounge",
  "Spa", "Gym", "Garden", "Beach", "Mountain View", "City View",
  "Terrace", "Balcony", "Outside View", "Facade", "Dining Area",
  "Kids Area", "Conference Room", "Activities & Experiences",
  "Bedroom", "Bathroom", "Living Room", "Parking", "Corridor",
];

const GUEST_HOUSE_PHOTO_TAGS = [
  "Bedroom", "Bathroom", "Common Area", "Dining Area", "Kitchen",
  "Garden", "Entrance", "Terrace", "Living Room", "Parking",
  "Outside View", "Facade",
];
const MAX_TAGS = 3;
const MIN_TOTAL_PHOTOS = 6;
const MIN_ROOM_TAGGED_PHOTOS = 2;
const ROOM_TAG = "Bedroom";

function groupPhotosByTag(photos: HotelPhoto[]): { tag: string; photos: HotelPhoto[] }[] {
  const map = new Map<string, HotelPhoto[]>();
  for (const photo of photos) {
    const tag = photo.tags[0];
    if (!tag) continue;
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag)!.push(photo);
  }
  return Array.from(map.entries()).map(([tag, photos]) => ({ tag, photos }));
}

// ── Skeleton card (shown while uploading) ────────────────────────────────────

function PhotoSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="w-22 h-15 rounded-lg bg-neutral-200 animate-pulse" />
      <div className="w-12 h-2 rounded-full bg-neutral-200 animate-pulse mt-0.5" />
    </div>
  );
}

// ── Photo preview lightbox ────────────────────────────────────────────────────

function PhotoPreviewModal({
  photo,
  tags,
  saving,
  onToggleTag,
  onClose,
  onCover,
  onDelete,
  photoTags,
}: {
  photo: HotelPhoto;
  tags: string[];
  saving: boolean;
  onToggleTag: (tag: string) => void;
  onClose: () => void;
  onCover: () => void;
  onDelete: () => void;
  photoTags: string[];
}) {
  const [search, setSearch] = useState("");

  const visible = photoTags.filter(
    (t) => !search || t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 z-10 size-7 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <XIcon size={13} weight="bold" />
        </button>

        {/* Large image */}
        <div className="relative w-full bg-black flex-none" style={{ aspectRatio: "16/9" }}>
          {photo.url ? (
            <Image src={photo.url} alt="Preview" fill className="object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon size={40} className="text-neutral-600" />
            </div>
          )}
          {photo.is_primary && (
            <div className="absolute top-2.5 left-2.5 bg-emerald-500 rounded-lg px-2 py-1 flex items-center gap-1">
              <StarIcon size={9} weight="fill" className="text-white" />
              <p className="text-[9px] font-bold text-white uppercase tracking-wide">Cover</p>
            </div>
          )}
        </div>

        {/* Tag editor */}
        <div className="overflow-y-auto flex-1">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-neutral-800">Edit Tags</p>
              <div className="flex items-center gap-2">
                {saving && <span className="text-[11px] text-primary-500">Saving…</span>}
                <span className={cn(
                  "text-[11px] font-semibold rounded-full px-2 py-0.5",
                  tags.length >= MAX_TAGS ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-500"
                )}>
                  {tags.length}/{MAX_TAGS}
                </span>
              </div>
            </div>

            {/* Selected chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200 rounded-full pl-2.5 pr-1.5 py-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    {tag}
                    <XIcon size={9} weight="bold" />
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative mb-3">
              <MagnifyingGlassIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tags…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 placeholder:text-neutral-400"
              />
            </div>

            {/* Tag pill grid */}
            <div className="flex flex-wrap gap-1.5">
              {visible.length === 0 ? (
                <p className="text-xs text-neutral-400 py-2">No matching tags</p>
              ) : (
                visible.map((tag) => {
                  const selected = tags.includes(tag);
                  const disabled = !selected && tags.length >= MAX_TAGS;
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleTag(tag)}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors",
                        selected
                          ? "bg-primary-500 text-white border-primary-500"
                          : disabled
                            ? "border-neutral-200 text-neutral-300 cursor-not-allowed"
                            : "border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50"
                      )}
                    >
                      {selected && <CheckIcon size={9} weight="bold" />}
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-neutral-100 flex-none">
          {!photo.is_primary && (
            <button
              type="button"
              onClick={onCover}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-emerald-600 transition-colors"
            >
              <StarIcon size={13} />
              Set as cover
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-red-500 transition-colors ml-auto"
          >
            <TrashIcon size={13} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Photo card ────────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  hotelId,
  onTagsChange,
  onDelete,
  onCover,
  showCaption = true,
  photoTags,
  hasTagError = false,
}: {
  photo: HotelPhoto;
  hotelId: number;
  onTagsChange: (photoId: number, tags: string[]) => void;
  onDelete: (photoId: number) => void;
  onCover: (photoId: number) => void;
  showCaption?: boolean;
  photoTags: string[];
  hasTagError?: boolean;
}) {
  const [tagOpen, setTagOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tags, setTags] = useState(photo.tags);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function handleTagOpenChange(next: boolean) {
    setTagOpen(next);
    if (!next) setSearch("");
  }

  async function toggleTag(tag: string) {
    let next: string[];
    if (tags.includes(tag)) {
      next = tags.filter((t) => t !== tag);
    } else {
      if (tags.length >= MAX_TAGS) return;
      next = [...tags, tag];
    }
    setTags(next);
    onTagsChange(photo.id, next);
    setSaving(true);
    await savePhotoTags(hotelId, photo.id, next);
    setSaving(false);
  }

  const visible = photoTags.filter(
    (t) => !search || t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Popover.Root open={tagOpen} onOpenChange={handleTagOpenChange}>
        <div className="flex flex-col items-center gap-1 shrink-0">

          {/* Thumbnail — click opens preview lightbox */}
          <div
            className={cn(
              "relative group w-22 h-15 rounded-lg overflow-hidden bg-neutral-100 cursor-zoom-in",
              hasTagError && tags.length === 0 && "ring-2 ring-red-400 ring-offset-1"
            )}
            onClick={() => setPreviewOpen(true)}
          >
            {photo.url ? (
              <Image src={photo.url} alt={tags.join(", ") || "Photo"} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon size={14} className="text-neutral-300" />
              </div>
            )}

            {photo.is_primary && (
              <div className="absolute top-1 left-1 bg-emerald-500 rounded px-1 py-0.5 flex items-center gap-0.5 pointer-events-none">
                <StarIcon size={6} weight="fill" className="text-white" />
                <p className="text-[7px] font-bold text-white uppercase tracking-wide">Cover</p>
              </div>
            )}

            {/* Hover overlay — tag icon left, star+delete right */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-1 pointer-events-none">
              {/* Tag edit trigger */}
              <Popover.Trigger asChild>
                <button
                  type="button"
                  title="Edit tags"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "size-5 rounded flex items-center justify-center transition-colors pointer-events-auto",
                    hasTagError && tags.length === 0
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-white/90 text-neutral-700 hover:text-primary-600"
                  )}
                >
                  <TagIcon size={10} />
                </button>
              </Popover.Trigger>

              {/* Star + delete */}
              <div className="flex items-center gap-1">
                {!photo.is_primary && (
                  <button
                    type="button"
                    title="Set as cover"
                    onClick={(e) => { e.stopPropagation(); onCover(photo.id); }}
                    className="size-5 rounded bg-white/90 flex items-center justify-center text-neutral-700 hover:text-emerald-600 transition-colors pointer-events-auto"
                  >
                    <StarIcon size={10} />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                  className="size-5 rounded bg-white/90 flex items-center justify-center text-neutral-700 hover:text-red-500 transition-colors pointer-events-auto"
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            </div>
          </div>

          {/* Tag caption / Add Tag CTA */}
          {tags.length === 0 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTagOpenChange(true); }}
              className={cn(
                "inline-flex items-center gap-0.5 text-[9px] font-semibold rounded-full px-1.5 py-0.5 border transition-colors mt-0.5",
                hasTagError
                  ? "border-red-300 text-red-500 bg-red-50 hover:bg-red-100"
                  : "border-neutral-200 text-neutral-500 bg-white hover:border-primary-300 hover:text-primary-500"
              )}
            >
              <TagIcon size={7} />
              Add Tag
            </button>
          ) : showCaption ? (
            <p className="text-[10px] text-neutral-500 text-center leading-tight w-22 truncate px-0.5">
              {tags[0]}
            </p>
          ) : null}

          {/* Popover — auto-positioned, stays open on multi-select */}
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={6}
              avoidCollisions
              collisionPadding={12}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-56 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-100"
            >
              <div className="px-3 pt-3 pb-2 border-b border-neutral-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-neutral-700">Select Tags</p>
                  <div className="flex items-center gap-1.5">
                    {saving && <span className="text-[10px] text-primary-500">Saving…</span>}
                    <span className={cn(
                      "text-[10px] font-semibold rounded-full px-1.5 py-0.5",
                      tags.length >= MAX_TAGS ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-500"
                    )}>
                      {tags.length}/{MAX_TAGS}
                    </span>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200 rounded-full pl-2 pr-1 py-0.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        {tag}
                        <XIcon size={8} weight="bold" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <MagnifyingGlassIcon size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg border border-neutral-200 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto py-1">
                {visible.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 text-center py-4">No matching tags</p>
                ) : (
                  visible.map((tag) => {
                    const selected = tags.includes(tag);
                    const disabled = !selected && tags.length >= MAX_TAGS;
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-left transition-colors",
                          selected ? "bg-primary-50 text-primary-700" : disabled ? "text-neutral-300 cursor-not-allowed" : "text-neutral-700 hover:bg-neutral-50"
                        )}
                      >
                        <div className={cn(
                          "size-3.5 rounded flex items-center justify-center shrink-0 border transition-colors",
                          selected ? "bg-primary-500 border-primary-500" : "bg-white border-neutral-300"
                        )}>
                          {selected && <CheckIcon size={8} weight="bold" className="text-white" />}
                        </div>
                        {tag}
                      </button>
                    );
                  })
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </div>
      </Popover.Root>

      {/* Preview lightbox — rendered via portal to escape stacking contexts */}
      {previewOpen && createPortal(
        <PhotoPreviewModal
          photo={photo}
          tags={tags}
          saving={saving}
          photoTags={photoTags}
          onToggleTag={toggleTag}
          onClose={() => setPreviewOpen(false)}
          onCover={() => { onCover(photo.id); setPreviewOpen(false); }}
          onDelete={() => { onDelete(photo.id); setPreviewOpen(false); }}
        />,
        document.body
      )}
    </>
  );
}

// ── Upload button ─────────────────────────────────────────────────────────────

function UploadButton({
  hotelId,
  label = "Upload More",
  variant = "primary",
  disabled: externallyDisabled = false,
  onStart,
  onEnd,
}: {
  hotelId: number;
  label?: string;
  variant?: "primary" | "ghost" | "dashed";
  disabled?: boolean;
  onStart?: (count: number) => void;
  onEnd?: (result: { count?: number; error?: string }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    onStart?.(files.length);
    setUploading(true);
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    let result: { count?: number; error?: string } = {};
    try {
      result = await uploadHotelPhotos(hotelId, fd);
    } catch (err) {
      result = { error: err instanceof Error ? err.message : "Upload failed." };
    } finally {
      setUploading(false);
      e.target.value = "";
      onEnd?.(result);
    }
  }

  const isDisabled = uploading || externallyDisabled;

  return (
    <>
      <input ref={ref} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleChange} />
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => ref.current?.click()}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60",
          variant === "primary" && "h-8 px-4 bg-primary-500 hover:bg-primary-600 text-white",
          variant === "ghost" && "h-7 px-3 border border-neutral-200 text-neutral-600 hover:bg-neutral-50",
          variant === "dashed" && "h-16 w-16 flex-col border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 rounded-xl gap-0.5",
        )}
      >
        {uploading ? (
          <span>{variant === "dashed" ? "…" : "Uploading…"}</span>
        ) : (
          <>
            <PlusIcon size={variant === "dashed" ? 18 : 11} weight="bold" />
            {label && <span>{label}</span>}
          </>
        )}
      </button>
    </>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export type { HotelPhoto, PhotoCategory };

export default function PhotosTab({
  hotelId,
  categories,
  propertySubType,
}: {
  hotelId: number;
  categories: PhotoCategory[];
  propertySubType: string | null;
}) {
  const router = useRouter();

  const [photosState, setPhotosState] = useState<HotelPhoto[]>(
    () => categories.flatMap((c) => c.photos)
  );
  const [pendingUploads, setPendingUploads] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showTagError, setShowTagError] = useState(false);
  const untaggedRef = useRef<HTMLDivElement>(null);

  const boundProceed = proceedPhotos.bind(null, hotelId);
  const [actionState, formAction] = useActionState<{ error?: string }, FormData>(boundProceed, {});

  // Sync local state whenever the server re-fetches categories (after router.refresh())
  useEffect(() => {
    setPhotosState(categories.flatMap((c) => c.photos));
  }, [categories]);

  // Show server-side validation error (e.g. if client-side check was somehow bypassed)
  useEffect(() => {
    if (actionState?.error) {
      setTagError(actionState.error);
      setShowTagError(true);
      untaggedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [actionState]);

  const roomCategories = categories.filter((c) => !c.is_system);
  const photoTags = propertySubType === "GUEST_HOUSE" ? GUEST_HOUSE_PHOTO_TAGS : HOTEL_PHOTO_TAGS;

  const coverPhoto = photosState.find((p) => p.is_primary) ?? photosState[0] ?? null;
  const untagged = photosState.filter((p) => p.tags.length === 0);
  const tagged = photosState.filter((p) => p.tags.length > 0);
  const tagGroups = groupPhotosByTag(tagged);
  const total = photosState.length;

  // Auto-clear tag error once all photos have been tagged
  useEffect(() => {
    if (showTagError && untagged.length === 0) {
      setTagError(null);
      setShowTagError(false);
    }
  }, [untagged.length, showTagError]);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (total < MIN_TOTAL_PHOTOS) {
      e.preventDefault();
      setTagError(`At least ${MIN_TOTAL_PHOTOS} photos are required. You've uploaded ${total}.`);
      setShowTagError(true);
      return;
    }
    if (untagged.length > 0) {
      e.preventDefault();
      setTagError(
        `${untagged.length} photo${untagged.length > 1 ? "s are" : " is"} missing a tag. Add at least one tag to each photo to continue.`
      );
      setShowTagError(true);
      untaggedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const roomTaggedCount = photosState.filter((p) => p.tags.includes(ROOM_TAG)).length;
    if (roomTaggedCount < MIN_ROOM_TAGGED_PHOTOS) {
      e.preventDefault();
      setTagError(
        `At least ${MIN_ROOM_TAGGED_PHOTOS} photos tagged "${ROOM_TAG}" are required (currently ${roomTaggedCount}).`
      );
      setShowTagError(true);
      return;
    }
    setTagError(null);
    setShowTagError(false);
  }

  // ── Upload handlers ──────────────────────────────────────────────────────────

  function handleUploadStart(count: number) {
    setPendingUploads(count);
    setUploadError(null);
  }

  function handleUploadEnd(result: { count?: number; error?: string }) {
    setPendingUploads(0);
    if (result.error) setUploadError(result.error);
    router.refresh(); // always refresh — show partial uploads too
  }

  // ── Photo interactions ───────────────────────────────────────────────────────

  function handleTagsChange(photoId: number, tags: string[]) {
    setPhotosState((prev) => prev.map((p) => p.id === photoId ? { ...p, tags } : p));
  }

  async function handleDelete(photoId: number) {
    // Optimistic: remove immediately so the UI responds instantly
    setPhotosState((prev) => prev.filter((p) => p.id !== photoId));
    const result = await deleteHotelPhoto(hotelId, photoId);
    if (result.error) {
      // Restore by re-syncing from the server
      setUploadError(result.error);
    }
    router.refresh(); // always refresh to keep server and UI in sync
  }

  async function handleCover(photoId: number) {
    await setCoverPhoto(hotelId, photoId);
    setPhotosState((prev) => prev.map((p) => ({ ...p, is_primary: p.id === photoId })));
  }

  // ── Uploading state (skeleton section) ──────────────────────────────────────

  const isUploading = pendingUploads > 0;

  const skeletonSection = isUploading && (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="px-5 py-3.5 border-b border-primary-200 bg-primary-50/60 rounded-t-[inherit] flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-primary-500" />
        </span>
        <p className="text-sm font-semibold text-primary-700">
          Uploading {pendingUploads} photo{pendingUploads > 1 ? "s" : ""}…
        </p>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: pendingUploads }).map((_, i) => (
            <PhotoSkeleton key={i} />
          ))}
        </div>
      </div>
    </Card>
  );

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (total === 0 && !isUploading) {
    return (
      <div className="space-y-3">
        {(uploadError || tagError) && (
          <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            <WarningIcon size={15} className="shrink-0 mt-0.5" />
            <span className="flex-1">{tagError ?? uploadError}</span>
            <button type="button" onClick={() => { setUploadError(null); setTagError(null); }} className="shrink-0 text-red-400 hover:text-red-600">
              <XIcon size={13} />
            </button>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed border-neutral-200 bg-white text-center">
          <div className="size-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <ImageIcon size={26} className="text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-800 mb-1">No photos yet</p>
          <p className="text-xs text-neutral-400 mb-6 max-w-xs leading-relaxed">
            Upload high-quality photos to attract more guests.
          </p>
          <UploadButton hotelId={hotelId} label="Upload Photos" onStart={handleUploadStart} onEnd={handleUploadEnd} />
        </div>
        <form id="wizard-form" action={formAction} onSubmit={handleFormSubmit} className="hidden" />
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-8">

      {/* Tag validation error banner */}
      {tagError && (
        <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          <WarningIcon size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Photos need tags</p>
            <p className="text-xs mt-0.5">{tagError}</p>
            {untagged.length > 0 && (
              <button
                type="button"
                onClick={() => untaggedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="text-xs font-medium text-red-600 underline underline-offset-2 mt-1"
              >
                Jump to untagged photos ↓
              </button>
            )}
          </div>
          <button type="button" onClick={() => setTagError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <XIcon size={13} />
          </button>
        </div>
      )}

      {/* Upload error banner */}
      {uploadError && (
        <div className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
          <WarningIcon size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <XIcon size={13} />
          </button>
        </div>
      )}

      {/* Skeleton section for pending uploads */}
      {skeletonSection}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Photos &amp; Videos
          <span className="ml-1.5 text-neutral-400 font-normal">({total})</span>
        </h2>
        <UploadButton hotelId={hotelId} disabled={isUploading} onStart={handleUploadStart} onEnd={handleUploadEnd} />
      </div>

      {/* Cover photo */}
      <Card variant="elevated" radius="md" className="overflow-hidden p-px">
        <div className="px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b bg-neutral-50 rounded-t-[inherit] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-800">Property cover photo</h3>
            {coverPhoto?.tags[0] && (
              <p className="text-xs text-neutral-600/90 mt-0.5">{coverPhoto.tags[0]}</p>
            )}
          </div>
          <div className="shrink-0">
            <UploadButton hotelId={hotelId} label="Change" variant="ghost" disabled={isUploading} onStart={handleUploadStart} onEnd={handleUploadEnd} />
          </div>
        </div>
        <div className="relative w-full" style={{ aspectRatio: "16/5" }}>
          {coverPhoto?.url ? (
            <Image src={coverPhoto.url} alt="Property cover" fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-neutral-100 flex items-center justify-center">
              <ImageIcon size={32} className="text-neutral-300" />
            </div>
          )}
        </div>
      </Card>

      {/* Rooms & restaurant(s) */}
      <SectionCard
        title="Photos & Videos assigned to rooms & restaurant(s)"
        desc="Photos help customers visualize what the room looks like"
      >
        {roomCategories.length === 0 ? (
          <div className="flex items-center gap-4">
            <UploadButton hotelId={hotelId} label="Add" variant="dashed" disabled={isUploading} onStart={handleUploadStart} onEnd={handleUploadEnd} />
            <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
              No room categories yet. Add rooms first to organise photos by room type.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {roomCategories.map((cat) => {
              const catPhotos = photosState.filter((p) => p.category_id === cat.id);
              return (
                <div key={cat.id}>
                  <p className="text-xs font-semibold text-neutral-700 mb-2">{cat.name}</p>
                  <div className="flex flex-wrap gap-3">
                    {catPhotos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        hotelId={hotelId}
                        photoTags={photoTags}
                        onTagsChange={handleTagsChange}
                        onDelete={handleDelete}
                        onCover={handleCover}
                      />
                    ))}
                    <UploadButton hotelId={hotelId} label="Add" variant="dashed" disabled={isUploading} onStart={handleUploadStart} onEnd={handleUploadEnd} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Untagged section */}
      {untagged.length > 0 && (
        <div ref={untaggedRef}>
          <Card
            variant="elevated"
            radius="md"
            className={cn(
              "overflow-hidden p-px",
              showTagError && "ring-red-300 shadow-red-100/60"
            )}
          >
            <div className={cn(
              "px-5 py-3.5 border-b bg-linear-to-b rounded-t-[inherit] flex items-start justify-between gap-4",
              showTagError ? "border-red-200 bg-red-50" : "border-neutral-200 bg-neutral-50"
            )}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {showTagError && <WarningIcon size={13} className="text-red-500 shrink-0" />}
                  <h3 className={cn("text-sm font-semibold", showTagError ? "text-red-800" : "text-neutral-800")}>
                    Untagged Photos &amp; Videos
                    <span className={cn("ml-1.5 font-normal", showTagError ? "text-red-400" : "text-neutral-400")}>
                      ({untagged.length})
                    </span>
                  </h3>
                </div>
                <p className={cn("text-xs mt-0.5", showTagError ? "text-red-600/90" : "text-neutral-600/90")}>
                  {showTagError
                    ? <>Each photo needs at least 1 tag — click <TagIcon size={10} className="inline mx-0.5" /> or the <strong>Add Tag</strong> button below each photo.</>
                    : <>Hover a photo and click <TagIcon size={10} className="inline mx-0.5" /> to tag it, or click the <strong>Add Tag</strong> button below each photo.</>
                  }
                </p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-3">
                {untagged.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    hotelId={hotelId}
                    photoTags={photoTags}
                    onTagsChange={handleTagsChange}
                    onDelete={handleDelete}
                    onCover={handleCover}
                    showCaption={false}
                    hasTagError={showTagError}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tagged photos grouped by tag */}
      {tagged.length > 0 && (
        <SectionCard title="Photos & Videos tagged">
          <div className="space-y-5">
            {tagGroups.map(({ tag, photos: groupPhotos }) => (
              <div key={tag}>
                <p className="text-[11px] font-semibold text-neutral-400 mb-2.5 uppercase tracking-widest">
                  {tag}
                </p>
                <div className="flex flex-wrap gap-3">
                  {groupPhotos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      hotelId={hotelId}
                      photoTags={photoTags}
                      onTagsChange={handleTagsChange}
                      onDelete={handleDelete}
                      onCover={handleCover}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Hidden form — wires the WizardShell "Save & Continue" button to tag validation */}
      <form id="wizard-form" action={formAction} onSubmit={handleFormSubmit} className="hidden" />
    </div>
  );
}
