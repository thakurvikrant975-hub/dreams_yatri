import Card from "@/app/components/ui/Card"
import { Heading } from "@/app/components/ui/Typography"
import { cn } from "@/app/lib/utils"

export function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn(className, 'p-px')}>
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 rounded-t-[inherit] border-b border-b-(--border-default)">
        <Heading level={3} size="base" weight="semibold" className="text-primary">
          {title}
        </Heading>
        {subtitle && <p className="text-xs text-[--text-muted] mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
    </Card>
  )
}
