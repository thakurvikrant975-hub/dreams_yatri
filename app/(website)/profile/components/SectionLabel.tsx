export function SectionLabel({
  title,
  hint,
}: {
  title: string
  hint?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">{title}</p>
      {hint && <span className="text-[10px] text-[--text-muted]">{hint}</span>}
    </div>
  )
}