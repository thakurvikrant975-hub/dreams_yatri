import { Card } from "@/app/components/ui/Card";
import ConnectHeader from "../components/ConnectHeader";

export default function BookingsLoading() {
  return (
    <>
      <ConnectHeader title="Bookings" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-7xl space-y-5 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} variant="default" radius="md" padding="md" className="h-20 bg-neutral-100/70" />
            ))}
          </div>
          <Card variant="elevated" radius="md" className="overflow-hidden">
            <div className="divide-y divide-neutral-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-5 h-20 bg-white" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
