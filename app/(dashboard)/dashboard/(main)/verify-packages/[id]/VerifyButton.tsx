"use client";

import { useTransition } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { verifyCustomPackage } from "../actions";

export function VerifyButton({ packageId }: { packageId: string }) {
    const [isPending, startTransition] = useTransition();

    function handleVerify() {
        startTransition(async () => {
            const result = await verifyCustomPackage(packageId);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <button
            type="button"
            onClick={handleVerify}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-dashboard-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {isPending ? "Verifying…" : "Verify Pricing"}
        </button>
    );
}
