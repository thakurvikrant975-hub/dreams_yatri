import * as React from "react"
import { cn } from "@/app/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition-colors",
        "placeholder:text-neutral-400",
        "focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20",
        "disabled:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed",
        "aria-invalid:border-red-400 aria-invalid:bg-red-50/30 aria-invalid:ring-2 aria-invalid:ring-red-400/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
