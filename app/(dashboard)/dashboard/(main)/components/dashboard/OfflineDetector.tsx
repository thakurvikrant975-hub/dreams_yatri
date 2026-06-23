"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineDetector() {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        // Read initial state client-side only to avoid hydration mismatch
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

    if (!offline) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-dashboard-base-100/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
                <div className="flex size-20 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-50">
                    <WifiOff className="size-9 text-amber-500" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-dashboard-base-content">
                        No Internet Connection
                    </h2>
                    <p className="mt-2 text-sm text-dashboard-neutral leading-relaxed">
                        You&apos;re currently offline. Please check your network connection and try again.
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer w-full rounded-lg bg-dashboard-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-dashboard-primary/90 transition-colors"
                >
                    Retry Connection
                </button>
                <p className="text-xs text-dashboard-neutral">
                    The page will automatically reconnect when your internet is restored.
                </p>
            </div>
        </div>
    );
}
