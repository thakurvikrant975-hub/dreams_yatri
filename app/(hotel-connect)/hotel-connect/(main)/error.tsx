"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon, WifiIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Button, buttonVariants } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";

export default function HotelConnectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error("[hotel-connect]", error);
    setOffline(!navigator.onLine);
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card variant="default" radius="lg" padding="lg" className="max-w-sm text-center">
        <div
          className={`mx-auto flex size-14 items-center justify-center rounded-full ${
            offline ? "bg-amber-50" : "bg-red-50"
          }`}
        >
          {offline ? (
            <WifiIcon className="size-7 text-amber-500" aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon className="size-7 text-red-500" aria-hidden="true" />
          )}
        </div>

        <h1 className="mt-4 text-lg font-semibold text-neutral-900">
          {offline ? "No internet connection" : "Something went wrong"}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          {offline
            ? "You're currently offline. Check your network connection and try again."
            : "This page ran into an unexpected error. Try again, or head back to your dashboard."}
        </p>

        {!offline && error.digest && (
          <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-mono text-neutral-500">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <Button variant="primary" size="md" onClick={reset} className="gap-1.5">
            <ArrowPathIcon className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Link href="/hotel-connect" className={buttonVariants({ variant: "outline", size: "md" })}>
            Go to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
