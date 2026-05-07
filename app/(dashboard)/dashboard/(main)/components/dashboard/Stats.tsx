import { LucideIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";


interface StatRow {
    label: string;
    value: number | string;
    muted?: boolean;
    icon?: LucideIcon;
    iconColor?: string;       // e.g. "text-amber-500"
    iconBg?: string;          // e.g. "bg-amber-500/10"
    accent?: "default" | "destructive" | "warning" | "success" | "primary";
}

interface StatsProps {
    rows: StatRow[];
    cols?: 2 | 3 | 4 | 5;
}

const accentMap: Record<
    NonNullable<StatRow["accent"]>,
    { value: string; border: string; bg: string }
> = {
    default:     { value: "text-foreground",   border: "border-border",          bg: "" },
    destructive: { value: "text-destructive",   border: "border-destructive/30",  bg: "bg-destructive/5" },
    warning:     { value: "text-amber-600",     border: "border-amber-300/40",    bg: "bg-amber-50/60 dark:bg-amber-950/20" },
    success:     { value: "text-emerald-600",   border: "border-emerald-300/40",  bg: "bg-emerald-50/60 dark:bg-emerald-950/20" },
    primary:     { value: "text-primary",       border: "border-primary/30",      bg: "bg-primary/5" },
};

function StatCard({ label, value, muted, icon: Icon, iconColor, iconBg, accent = "default" }: StatRow) {
    const a = accentMap[accent];
    return (
        <div className={cn(
            "rounded-xl border px-4 py-3.5 flex items-center gap-3 transition-all",
            a.bg || "bg-muted/40",
            a.border,
        )}>
            {Icon && (
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconBg ?? "bg-muted")}>
                    <Icon className={cn("h-4.5 w-4.5", iconColor ?? "text-muted-foreground")} size={18} />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                <p className={cn("text-2xl font-bold leading-tight tracking-tight mt-0.5",
                    muted ? "text-muted-foreground" : a.value,
                )}>
                    {value}
                </p>
            </div>
        </div>
    );
}

const colsClass: Record<NonNullable<StatsProps["cols"]>, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
};

export function Stats({ rows, cols = 4 }: StatsProps) {
    return (
        <div className={cn("grid gap-3", colsClass[cols])}>
            {rows.map((row) => (
                <StatCard key={row.label} {...row} />
            ))}
        </div>
    );
}