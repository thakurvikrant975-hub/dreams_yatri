import * as React from "react"
import { cn } from "@/app/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "block text-[11px] font-semibold text-neutral-700 uppercase tracking-widest leading-none",
        className
      )}
      {...props}
    />
  )
}

export { Label }
