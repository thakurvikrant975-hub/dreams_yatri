import { Card } from "@/app/components/ui/Card";

export default function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        {desc && <p className="text-xs text-neutral-600/90 mt-0.5">{desc}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </Card>
  );
}
