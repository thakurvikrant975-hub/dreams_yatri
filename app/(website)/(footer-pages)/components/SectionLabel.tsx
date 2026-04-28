export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-0.5 bg-red-500" />
      <span className="text-red-500 text-xs font-bold uppercase tracking-widest">{children}</span>
    </div>
  );
}