import type { Metadata } from "next";
import { PoliciesClient } from "./PoliciesClient";
import type { PolicyType } from "./constants";

export const metadata: Metadata = {
    title: "Policies - Dashboard",
    description: "",
    robots: {
        index:     false,
        follow:    false,
        nocache:   true,
        googleBot: { index: false, follow: false },
    },
};

const VALID_LIMITS  = [10, 20, 50] as const;
const VALID_TYPES   = ["CANCELLATION", "DATE_CHANGE", "REFUND", "TERMS_AND_CONDITIONS"] as const;

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page    = Math.max(1, parseInt(sp.page  ?? "1",  10) || 1);
    const rawLim  = parseInt(sp.limit ?? "10", 10);
    const limit   = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 10;
    const search  = (sp.search ?? "").trim();
    const status  = (["active", "inactive"].includes(sp.status ?? "")
        ? sp.status : "all") as "active" | "inactive" | "all";
    const rawType = sp.type ?? "all";
    const type    = ((VALID_TYPES as readonly string[]).includes(rawType)
        ? rawType : "all") as PolicyType | "all";

    return (
        <PoliciesClient
            page={page}
            limit={limit}
            search={search}
            type={type}
            status={status}
        />
    );
}
