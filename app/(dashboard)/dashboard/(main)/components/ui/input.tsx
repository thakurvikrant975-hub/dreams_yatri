import * as React from "react"
import { cn } from "@/app/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "h-10 w-full min-w-0 rounded-lg px-3 py-2 text-xs outline-none transition-colors",
        // Colors
        "bg-dashboard-base-100 border border-dashboard-base-content/85",
        "text-dashboard-base-content placeholder:text-dashboard-base-content/35",
        // Focus
        "focus-visible:border-dashboard-primary focus-visible:ring-1 focus-visible:ring-dashboard-primary/30",
        // File input
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-dashboard-base-content",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-dashboard-base-200 disabled:opacity-50",
        // Invalid
        "aria-invalid:border-dashboard-error aria-invalid:ring-1 aria-invalid:ring-dashboard-error/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }