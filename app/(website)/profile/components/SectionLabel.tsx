import Label from "@/app/components/forms/Label"
export function SectionLabel({
  title,
  hint,
}: {
  title: string
  hint?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <p className="text-sm font-semibold capitalize tracking-wide text-primary">{title}</p>
      {hint && <span className="text-xs text-secondary">{hint}</span>}
    </div>
  )
}