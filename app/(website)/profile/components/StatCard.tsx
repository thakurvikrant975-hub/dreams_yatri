export function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 sm:px-4 py-3 rounded-xl bg-neutral-50 backdrop-blur-sm ring-1 ring-inset ring-(--border-default) border-white/20 min-w-0 flex-1 sm:flex-none sm:min-w-20">
      <span className="text-muted">{icon}</span>
      <span className="text-base sm:text-lg font-bold text-primary leading-none">{value}</span>
      <span className="text-[10px] sm:text-[11px] text-secondary font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}
