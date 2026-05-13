// components/dashboard/PageHeader.tsx
import { cn } from "@/app/lib/utils";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import type { LucideIcon } from "lucide-react";
import { RefreshButton } from "./RefreshButton";

interface RefreshAction {
  onRefresh: () => void;
  isPending?: boolean;
  label?: string; // defaults to "Refresh"
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  actions?: React.ReactNode;        
  refreshAction?: RefreshAction;
  className?: string;
}

/** Consistent style token for every header-level button */
export const headerButtonClass =
  "rounded-md bg-dashboard-primary text-dashboard-base-100 px-4 " +
  "hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100";

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2 rounded-lg bg-dashboard-primary/10">
                        <Icon className="h-5 w-5 text-dashboard-primary" />
                    </div>
                )}
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{title}</h1>
                    {description && (
                        <p className="text-sm text-dashboard-base-content/60">{description}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <RefreshButton />       
                {actions}
            </div>
        </div>
    );
}