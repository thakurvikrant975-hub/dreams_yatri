"use client";

import { useEffect, useState } from "react";

function RatSVG() {
    return (
        <svg
            width="300" height="258"
            viewBox="0 0 360 310"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* === WiFi Signal (top-right) === */}
            <path d="M258,48 Q298,10 338,48" stroke="#2D2D2D" strokeWidth="8" strokeLinecap="round" />
            <path d="M268,70 Q298,42 328,70" stroke="#2D2D2D" strokeWidth="8" strokeLinecap="round" />
            <path d="M278,91 Q298,76 318,91" stroke="#2D2D2D" strokeWidth="8" strokeLinecap="round" />
            <circle cx="298" cy="109" r="8" fill="#2D2D2D" />

            {/* Cable from WiFi dot → scissors cut point */}
            <path
                d="M298,117 C293,133 278,153 262,173 C250,188 238,201 230,213"
                stroke="#2D2D2D" strokeWidth="5" strokeLinecap="round"
            />
            {/* Severed end (dashed, dangling after cut) */}
            <path
                d="M222,223 C217,234 210,248 203,261"
                stroke="#2D2D2D" strokeWidth="5" strokeLinecap="round" strokeDasharray="4 5"
            />

            {/* === Rat === */}

            {/* Tail — drawn first so it sits behind body */}
            <path
                d="M200,269 Q255,261 265,229 Q274,203 249,191"
                stroke="#C07050" strokeWidth="10" strokeLinecap="round"
            />

            {/* Body */}
            <ellipse cx="145" cy="214" rx="68" ry="74" fill="#8A8580" />

            {/* Right arm reaching to scissors */}
            <path d="M198,201 Q216,209 226,221" stroke="#8A8580" strokeWidth="20" strokeLinecap="round" />

            {/* Left arm resting */}
            <path d="M96,214 Q78,229 72,243" stroke="#8A8580" strokeWidth="20" strokeLinecap="round" />
            <ellipse cx="69" cy="248" rx="14" ry="10" fill="#8A8580" />

            {/* Left ear */}
            <circle cx="100" cy="111" r="28" fill="#8A8580" />
            <circle cx="100" cy="111" r="18" fill="#E8937A" />

            {/* Right ear */}
            <circle cx="188" cy="111" r="28" fill="#8A8580" />
            <circle cx="188" cy="111" r="18" fill="#E8937A" />

            {/* Head */}
            <circle cx="143" cy="151" r="60" fill="#8A8580" />

            {/* Eyes — whites */}
            <circle cx="124" cy="142" r="13" fill="white" />
            <circle cx="160" cy="142" r="13" fill="white" />
            {/* Pupils */}
            <circle cx="126" cy="144" r="7.5" fill="#222" />
            <circle cx="162" cy="144" r="7.5" fill="#222" />
            {/* Eye shine */}
            <circle cx="129" cy="140" r="3" fill="white" />
            <circle cx="165" cy="140" r="3" fill="white" />

            {/* Nose */}
            <ellipse cx="143" cy="163" rx="7" ry="5" fill="#E8937A" />

            {/* Smile */}
            <path d="M137,170 Q143,177 149,170" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" />

            {/* Whiskers left */}
            <line x1="136" y1="161" x2="100" y2="155" stroke="#555" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
            <line x1="136" y1="166" x2="99"  y2="166" stroke="#555" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />

            {/* Whiskers right */}
            <line x1="150" y1="161" x2="186" y2="155" stroke="#555" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
            <line x1="150" y1="166" x2="187" y2="166" stroke="#555" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />

            {/* === Scissors at cut point === */}
            <g transform="translate(226,221) rotate(40)">
                {/* Pivot */}
                <circle cx="0" cy="0" r="5.5" fill="#888" />
                {/* Upper blade */}
                <line x1="0" y1="0" x2="26" y2="-8" stroke="#CCC" strokeWidth="6" strokeLinecap="round" />
                {/* Lower blade */}
                <line x1="0" y1="0" x2="26" y2="8"  stroke="#CCC" strokeWidth="6" strokeLinecap="round" />
                {/* Upper handle loop */}
                <ellipse cx="-14" cy="-9" rx="11" ry="8" fill="none" stroke="#999" strokeWidth="4"
                    transform="rotate(-15,-14,-9)" />
                {/* Lower handle loop */}
                <ellipse cx="-14" cy="9"  rx="11" ry="8" fill="none" stroke="#999" strokeWidth="4"
                    transform="rotate(15,-14,9)" />
            </g>

            {/* Sparkles at cut point */}
            <line x1="215" y1="210" x2="209" y2="202" stroke="#FFB830" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="222" y1="207" x2="220" y2="198" stroke="#FFB830" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="231" y1="210" x2="237" y2="203" stroke="#FFB830" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="213" y1="218" x2="204" y2="218" stroke="#FFB830" strokeWidth="2"   strokeLinecap="round" />

            {/* Ground shadow */}
            <ellipse cx="148" cy="297" rx="82" ry="10" fill="#aaa" opacity="0.25" />
        </svg>
    );
}

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
                <RatSVG />
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
