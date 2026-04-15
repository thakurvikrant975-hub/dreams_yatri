interface StatRow {
    label: string;
    value: number | string;
    muted?: boolean;
}

interface StatsProps {
    rows: StatRow[];
}

function StatCard({ label, value, muted }: StatRow) {
    return (
        <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${muted ? "text-muted-foreground" : ""}`}>{value}</p>
        </div>
    );
}

export function Stats({ rows }: StatsProps) {
    return (
        <div className="grid grid-cols-4 gap-4">
            {rows.map((row) => (
                <StatCard key={row.label} {...row} />
            ))}
        </div>
    );
}