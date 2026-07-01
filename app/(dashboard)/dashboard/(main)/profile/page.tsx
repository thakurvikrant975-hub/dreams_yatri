import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyProfile } from "./actions";
import { ProfileClient } from "./ProfileClient";

export const metadata: Metadata = {
    title: "My Profile - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

export default async function ProfilePage() {
    const profile = await getMyProfile();
    if (!profile) redirect("/dashboard/login");

    return <ProfileClient profile={profile} />;
}
