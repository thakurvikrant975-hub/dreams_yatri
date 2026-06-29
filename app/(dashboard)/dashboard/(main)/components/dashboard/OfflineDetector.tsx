"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function OfflineDetector() {
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

    if (!offline) return null;

    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-dashboard-base-100/97 backdrop-blur-sm">
            <div className="mx-auto flex max-w-xs flex-col items-center gap-3 px-6 text-center select-none">
                <Image src="/no-internet.png" alt="Rat with scissors" width={240} height={240} priority />
                <h2 className="text-3xl font-bold tracking-tight text-dashboard-base-content">
                    No internet?
                </h2>
                <p className="text-base text-dashboard-neutral leading-relaxed">
                    Blame the rat! He thought the Wi-Fi wire was a snack.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer mt-2 rounded-full bg-dashboard-base-300 px-10 py-3 text-sm font-medium text-dashboard-base-content hover:bg-dashboard-base-300/70 transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}
