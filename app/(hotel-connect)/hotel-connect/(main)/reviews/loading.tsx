import { Card } from "@/app/components/ui/Card";
import ConnectHeader from "../components/ConnectHeader";

export default function ReviewsLoading() {
  return (
    <>
      <ConnectHeader title="Reviews" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card variant="elevated" radius="md" className="sm:col-span-1 h-40 bg-neutral-100/70" />
            <Card variant="elevated" radius="md" className="sm:col-span-2 h-40 bg-neutral-100/70" />
          </div>
          <Card variant="elevated" radius="md" className="overflow-hidden">
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-neutral-100" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
