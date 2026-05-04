"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { toast } from "sonner";

type Props = {
  dayNumber: number;
  title: string;
  description: string | null;
  onSave: (title: string, desc: string) => Promise<void>;
};

export function DayHeader({ dayNumber, title, description, onSave }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [isPending, startTransition] = useTransition();

  function commitTitle() {
    if (!titleDraft.trim() || titleDraft === title) {
      setEditingTitle(false);
      return;
    }
    startTransition(async () => {
      try {
        await onSave(titleDraft.trim(), description ?? "");
        setEditingTitle(false);
      } catch {
        toast.error("Failed to save title");
      }
    });
  }

  async function handleDescBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const newDesc = e.target.value;
    if (newDesc === (description ?? "")) return;
    try {
      await onSave(title, newDesc);
    } catch {
      toast.error("Failed to save description");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 px-4 py-3">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {dayNumber}
        </div>

        {editingTitle ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="h-7 flex-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") {
                  setTitleDraft(title);
                  setEditingTitle(false);
                }
              }}
            />
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={commitTitle}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setTitleDraft(title);
                setEditingTitle(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div
            className="group flex flex-1 cursor-pointer items-center gap-2"
            onClick={() => {
              setTitleDraft(title);
              setEditingTitle(true);
            }}
          >
            <p className="text-sm font-semibold group-hover:text-primary">{title}</p>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        )}
      </div>

      {/* Description */}
      <Textarea
        key={`${dayNumber}-desc`}
        defaultValue={description ?? ""}
        rows={2}
        placeholder="Day description (optional)..."
        className="resize-none text-sm"
        onBlur={handleDescBlur}
      />
    </div>
  );
}
