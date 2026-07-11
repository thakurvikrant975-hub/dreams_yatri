import { Card } from "@/app/components/ui/Card";

export default function SectionCard({
  title,
  desc,
  headerAction,
  children,
  className,
}: {
  title: string;
  desc?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card variant="elevated" radius="md" className={`overflow-hidden p-px ${className ?? ""}`}>
      <div className="px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b rounded-t-[inherit] bg-neutral-50 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
          {desc && <p className="text-xs text-neutral-600/90 mt-0.5">{desc}</p>}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </Card>
  );
}
