"use client";

import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        setOffline(!navigator.onLine);
        const goOnline  = () => setOffline(false);
        const goOffline = () => setOffline(true);
        window.addEventListener("online",  goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online",  goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className={`flex size-16 items-center justify-center rounded-full border-2 ${
                offline
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
            }`}>
                {offline
                    ? <WifiOff className="size-7 text-amber-500" />
                    : <AlertTriangle className="size-7 text-red-500" />
                }
            </div>

            <div className="max-w-sm">
                <h1 className="text-xl font-semibold text-dashboard-base-content">
                    {offline ? "No Internet Connection" : "Something went wrong"}
                </h1>
                <p className="mt-2 text-sm text-dashboard-neutral leading-relaxed">
                    {offline
                        ? "You're currently offline. Check your network connection and try again."
                        : "An unexpected error occurred. Try refreshing — if the issue persists, contact your system administrator."
                    }
                </p>
                {!offline && error.digest && (
                    <p className="mt-3 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2 text-[11px] font-mono text-dashboard-neutral">
                        Error ID: {error.digest}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2.5">
                <button
                    onClick={reset}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-dashboard-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-dashboard-primary/90 transition-colors"
                >
                    <RefreshCw className="size-3.5" />
                    Try again
                </button>
                <Link
                    href="/dashboard"
                    className="rounded-lg border border-dashboard-base-300 px-5 py-2.5 text-sm font-medium text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors"
                >
                    Go to dashboard
                </Link>
            </div>

            {offline && (
                <p className="text-xs text-dashboard-neutral">
                    The page will reconnect automatically when your internet is restored.
                </p>
            )}
        </div>
    );
}
