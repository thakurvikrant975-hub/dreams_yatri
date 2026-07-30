"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, PhoneCall } from "lucide-react";
import { toggleHotelReconfirmed, toggleCabReconfirmed } from "../actions";

export function ReconfirmButton({
    kind, bookingId, legNumber, reconfirmed,
}: {
    kind: "hotel" | "cab";
    bookingId: string;
    legNumber: number;
    reconfirmed: boolean;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [optimistic, setOptimistic] = useState(reconfirmed);

    function handleClick() {
        startTransition(async () => {
            const toggle = kind === "hotel" ? toggleHotelReconfirmed : toggleCabReconfirmed;
            const res = await toggle(bookingId, legNumber);
            if (!res.success) { toast.error(res.error); return; }
            setOptimistic(res.reconfirmed);
            toast.success(res.reconfirmed ? "Marked reconfirmed with vendor" : "Reconfirmation undone");
            router.refresh();
        });
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                optimistic
                    ? "border border-green-200 bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-dashboard-primary text-white hover:opacity-90"
            }`}
        >
            {optimistic ? <CheckCircle2 className="size-3.5" /> : <PhoneCall className="size-3.5" />}
            {pending ? "…" : optimistic ? "Reconfirmed" : "Mark reconfirmed"}
        </button>
    );
}
