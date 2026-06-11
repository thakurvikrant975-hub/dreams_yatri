import { Check } from "lucide-react";

export function Checkbox({
    checked, indeterminate = false, onChange, disabled = false, label,
}: {
    checked: boolean; indeterminate?: boolean; onChange: () => void;
    disabled?: boolean; label?: React.ReactNode;
}) {
    return (
        <label className={["flex items-center gap-2 cursor-pointer select-none", disabled ? "opacity-40 pointer-events-none" : ""].join(" ")}>
            <button
                type="button"
                role="checkbox"
                aria-checked={indeterminate ? "mixed" : checked}
                onClick={onChange}
                className={[
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
                    checked || indeterminate
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input bg-background hover:border-primary/60",
                ].join(" ")}
            >
                {indeterminate && !checked
                    ? <span className="block h-0.5 w-2 bg-current rounded" />
                    : checked
                        ? <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        : null}
            </button>
            {label && <span className="text-sm">{label}</span>}
        </label>
    );
}
