import Link from "next/link";
import { Compass } from "lucide-react";

export default function DashboardNotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-dashboard-base-300 bg-dashboard-base-200">
                <Compass className="size-7 text-dashboard-neutral" />
            </div>

            <div className="max-w-sm">
                <p className="text-6xl font-bold text-dashboard-base-300">404</p>
                <h1 className="mt-3 text-xl font-semibold text-dashboard-base-content">Page not found</h1>
                <p className="mt-2 text-sm text-dashboard-neutral leading-relaxed">
                    The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
                    Double-check the URL or navigate back to the dashboard.
                </p>
            </div>

            <Link
                href="/dashboard"
                className="rounded-lg bg-dashboard-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-dashboard-primary/90 transition-colors"
            >
                Go to dashboard
            </Link>
        </div>
    );
}
