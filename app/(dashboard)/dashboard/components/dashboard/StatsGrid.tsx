// components/dashboard/StatsGrid.tsx

import React from "react";

export type Stat = {
    label: string;
    value: number | string;
    highlight?: boolean;
    icon?: React.ReactNode;        // optional leading icon
    trend?: {
        value: number;             // e.g. 12 = +12%
        direction: "up" | "down";
    };
};

type StatsGridProps = {
    stats: Stat[];
    columns?: 2 | 3 | 4;          // flexible grid
};

const colClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
};

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
    return (
        <div className={`grid ${colClass[columns]} gap-4`}>
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="rounded-xl border bg-card p-4 space-y-1"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            {stat.label}
                        </p>
                        {stat.icon && (
                            <span className="text-muted-foreground">
                                {stat.icon}
                            </span>
                        )}
                    </div>

                    <p
                        className={`text-2xl font-bold ${
                            stat.highlight ? "text-primary" : ""
                        }`}
                    >
                        {stat.value}
                    </p>

                    {stat.trend && (
                        <p
                            className={`text-xs font-medium ${
                                stat.trend.direction === "up"
                                    ? "text-green-500"
                                    : "text-red-500"
                            }`}
                        >
                            {stat.trend.direction === "up" ? "↑" : "↓"}{" "}
                            {stat.trend.value}%
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}