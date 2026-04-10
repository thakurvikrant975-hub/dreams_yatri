export function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-neutral-50 backdrop-blur-sm ring-1 ring-inset ring-(--border-default) border-white/20 min-w-20">
      <span className="text-muted">{icon}</span>
      <span className="text-lg font-bold text-primary leading-none">{value}</span>
      <span className="text-[11px] text-secondary font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}