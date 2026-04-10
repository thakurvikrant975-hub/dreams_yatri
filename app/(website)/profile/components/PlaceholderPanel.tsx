import { Section } from "./Section"
import { GlobeAltIcon } from "@heroicons/react/24/outline";
export function PlaceholderPanel({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <GlobeAltIcon className="size-10 text-neutral-300 mb-3" />
        <p className="text-sm font-medium text-[--text-muted]">Coming soon</p>
        <p className="text-xs text-neutral-400 mt-1">This section is under development</p>
      </div>
    </Section>
  )
}