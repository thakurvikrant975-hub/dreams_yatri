import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { getCategoriesForSelect } from "../actions";
import { CreateActivityForm } from "./CreateActivityForm";

export const metadata: Metadata = {
    title: "New Activity - Dashboard",
    description: "",
    robots: {
        index:     false,
        follow:    false,
        nocache:   true,
        googleBot: { index: false, follow: false },
    },
};

export default async function NewActivityPage() {
    const categories = await getCategoriesForSelect();

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    Dashboard
                </Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/dashboard/activities" className="hover:text-foreground transition-colors">
                    Activities
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium">New Activity</span>
            </nav>

            {/* Page title */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">New Activity</h1>
                    <p className="text-sm text-muted-foreground">
                        Fill in the details below to create a new activity.
                    </p>
                </div>
            </div>

            <CreateActivityForm categories={categories} />
        </div>
    );
}
