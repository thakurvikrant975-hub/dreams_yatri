import { Card } from "@/app/components/ui/Card";
import ConnectHeader from "../../../components/ConnectHeader";

export default function CalendarLoading() {
  return (
    <>
      <ConnectHeader title="Rates & Inventory" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-7xl">
          <div className="grid lg:grid-cols-[1fr_400px] gap-5 animate-pulse">
            <Card variant="elevated" radius="lg" padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <div className="size-8 rounded-lg bg-neutral-100" />
                <div className="h-4 w-16 rounded bg-neutral-100" />
                <div className="size-8 rounded-lg bg-neutral-100" />
              </div>
              <div className="grid grid-cols-7 gap-px p-3">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-neutral-100" />
                ))}
              </div>
            </Card>
            <Card variant="default" radius="lg" padding="md" className="h-fit space-y-4">
              <div className="h-4 w-24 rounded bg-neutral-100" />
              <div className="h-9 rounded-lg bg-neutral-100" />
              <div className="h-9 rounded-lg bg-neutral-100" />
              <div className="h-9 rounded-lg bg-neutral-100" />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
