import * as React from "react"
import { cn } from "@/app/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-h-24 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors resize-none",
        "placeholder:text-neutral-400",
        "focus:ring-2 focus:ring-primary-500 focus:border-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "aria-invalid:border-red-400",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
