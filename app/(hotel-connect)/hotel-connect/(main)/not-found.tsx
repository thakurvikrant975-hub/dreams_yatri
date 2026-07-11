import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { buttonVariants } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

export default function HotelConnectNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card variant="default" radius="lg" padding="lg" className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-100">
          <MagnifyingGlassIcon className="size-7 text-neutral-400" aria-hidden="true" />
        </div>

        <h1 className="mt-4 text-lg font-semibold text-neutral-900">Page not found</h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>

        <div className="mt-5 flex justify-center">
          <Link href="/hotel-connect" className={buttonVariants({ variant: "primary", size: "md" })}>
            Back to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
