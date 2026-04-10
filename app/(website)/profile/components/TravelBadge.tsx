import { cn } from "@/app/lib/utils";

export function TravelBadge({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-[--text-muted] border-neutral-200 hover:border-primary/40 hover:text-primary'
      )}
    >
      {label}
    </button>
  )
}