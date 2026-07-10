// Shared presentational rate/restriction input rows, used by both
// ManageRatesClient (per-plan rate editing) and the rate-plan create/edit
// form. Kept at module scope, not defined inside a parent component — an
// inline function component gets a new identity every parent render, which
// makes React unmount/remount the <input> (and its focus) on every keystroke.

export const FIELD_LABEL = "text-sm font-medium text-neutral-800";
export const FIELD_SUB = "text-xs text-neutral-400";
export const FIELD_INPUT_WRAP = "h-10 w-36 rounded-lg border flex items-center px-2.5 gap-1 text-sm";
export const FIELD_INPUT = "w-full outline-none bg-transparent";

export function RateField({
  value, title, subtitle, onChange,
}: {
  value: number | null; title: string; subtitle?: string; onChange: (raw: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
      <div>
        <p className={FIELD_LABEL}>{title}</p>
        {subtitle && <p className={FIELD_SUB}>{subtitle}</p>}
      </div>
      <div className={`${FIELD_INPUT_WRAP} border-red-200`}>
        <span className="text-neutral-400">₹</span>
        <input
          type="number"
          min={0}
          step="1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter Rate"
          className={FIELD_INPUT}
        />
      </div>
    </div>
  );
}

export function RestrictionField({
  value, title, subtitle, onChange,
}: {
  value: number | null; title: string; subtitle?: string; onChange: (raw: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
      <div>
        <p className={FIELD_LABEL}>{title}</p>
        {subtitle && <p className={FIELD_SUB}>{subtitle}</p>}
      </div>
      <div className={`${FIELD_INPUT_WRAP} border-neutral-300`}>
        <input
          type="number"
          min={0}
          step="1"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className={FIELD_INPUT}
        />
      </div>
    </div>
  );
}
