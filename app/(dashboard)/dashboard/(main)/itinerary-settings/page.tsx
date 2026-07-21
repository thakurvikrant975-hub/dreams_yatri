import type { Metadata } from "next";
import { getCurrentActor } from "../(marketing)/queries/actions";
import { getItinerarySettings } from "./actions";
import ItinerarySettingsClient from "./ItinerarySettingsClient";

export const metadata: Metadata = {
    title: "Itinerary Settings - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function ItinerarySettingsPage() {
    const [settings, { actor }] = await Promise.all([
        getItinerarySettings(),
        getCurrentActor(),
    ]);
    const role = (actor as unknown as { role?: string } | undefined)?.role ?? null;
    const readOnly = role?.toLowerCase() === "sales executive";

    return <ItinerarySettingsClient settings={settings} readOnly={readOnly} />;
}
