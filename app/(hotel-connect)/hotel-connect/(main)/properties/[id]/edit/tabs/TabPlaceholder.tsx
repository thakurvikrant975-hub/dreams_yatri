import { ListChecks } from "@phosphor-icons/react/dist/ssr";

export default function TabPlaceholder({
  tabIndex,
  tabLabel,
}: {
  tabIndex: number;
  tabLabel: string;
}) {
  const PHASE_MAP: Record<number, number> = { 1: 4, 2: 5, 3: 5, 4: 5, 5: 6, 6: 6, 7: 6 };
  const phase = PHASE_MAP[tabIndex] ?? 5;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4">
        <ListChecks size={22} className="text-neutral-400" />
      </div>
      <h2 className="text-base font-semibold text-neutral-800 mb-1">
        {tabLabel}
      </h2>
      <p className="text-sm text-neutral-400 mb-4">
        This section is coming in Phase {phase}.
      </p>
      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
        Phase {phase} — in development
      </span>
    </div>
  );
}
