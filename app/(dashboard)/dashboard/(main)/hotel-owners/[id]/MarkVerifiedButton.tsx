"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "../../components/ui/button";
import { markOwnerVerified, unmarkOwnerVerified } from "../actions";

export function MarkVerifiedButton({ ownerId, verified }: { ownerId: string; verified: boolean }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function toggle() {
        setError(null);
        startTransition(async () => {
            const result = verified ? await unmarkOwnerVerified(ownerId) : await markOwnerVerified(ownerId);
            if (!result.ok) {
                setError(result.error ?? "Something went wrong.");
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="flex flex-col items-end gap-1.5">
            <Button
                variant={verified ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
                disabled={isPending}
                onClick={toggle}
            >
                {verified ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                {verified ? "Unmark Verified" : "Mark Verified"}
            </Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}
