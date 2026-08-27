"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, MapPin, User, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { PhoneInput } from "../(marketing)/queries/PhoneInput";
import { createLeadRequest, type LeadRequestFormState } from "../lead-requests/actions";
import type { DestinationOption } from "../(marketing)/queries/actions";

type MyRequest = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    destination: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    rejectionReason: string | null;
    createdAt: Date;
};

const STATUS_STYLES: Record<MyRequest["status"], string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    ACCEPTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

const initial: LeadRequestFormState = { success: false, message: "" };

export function RequestLeadForm({
    requests, destinations,
}: {
    requests: MyRequest[];
    destinations: DestinationOption[];
}) {
    const router = useRouter();
    const [state, action, isPending] = useActionState(createLeadRequest, initial);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [destination, setDestination] = useState("");
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (!state.message) return;
        if (state.success) {
            toast.success(state.message);
            formRef.current?.reset();
            setName(""); setEmail(""); setPhone(""); setDestination("");
            router.refresh();
        } else {
            toast.error(state.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form ref={formRef} action={action} className="space-y-4 rounded-xl border bg-card p-5 h-fit">
                <div className="space-y-1.5">
                    <Label htmlFor="name" className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Client name
                    </Label>
                    <Input
                        id="name" name="name" value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Client's full name" required
                    />
                    {state.errors?.name && <p className="text-xs text-dashboard-error">{state.errors.name[0]}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">Phone number</Label>
                    <PhoneInput name="phone" defaultValue="" onChange={setPhone} />
                    {state.errors?.phone && <p className="text-xs text-dashboard-error">{state.errors.phone[0]}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Email <span className="text-dashboard-base-content/40 font-normal">(optional)</span>
                    </Label>
                    <Input
                        id="email" name="email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@example.com"
                    />
                    {state.errors?.email && <p className="text-xs text-dashboard-error">{state.errors.email[0]}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Destination
                    </Label>
                    <input type="hidden" name="destination" value={destination} />
                    <Select value={destination} onValueChange={setDestination}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                            {destinations.map((d) => (
                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {state.errors?.destination && <p className="text-xs text-dashboard-error">{state.errors.destination[0]}</p>}
                </div>

                <Button type="submit" disabled={isPending} className="w-full gap-1.5">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isPending ? "Sending…" : "Send request"}
                </Button>
            </form>

            <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/40">
                    <p className="text-sm font-semibold">Your requests</p>
                </div>
                {requests.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-dashboard-base-content/50">
                        Nothing sent yet — your requests will show up here.
                    </p>
                ) : (
                    <div className="divide-y">
                        {requests.map((r) => (
                            <div key={r.id} className="px-4 py-3 space-y-1.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{r.name}</p>
                                        <p className="text-xs text-dashboard-base-content/50">
                                            {r.phone} · {r.destination}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                                        <span className="text-[11px] text-dashboard-base-content/40">
                                            {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>
                                {r.status === "REJECTED" && r.rejectionReason && (
                                    <p className="text-xs text-dashboard-error bg-red-50 dark:bg-red-950/20 rounded-md px-2 py-1">
                                        &quot;{r.rejectionReason}&quot;
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
