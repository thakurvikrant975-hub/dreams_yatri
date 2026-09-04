import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Partner Login - Dreams Yatri",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function PartnerLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Dreams Yatri Partners</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to see the leads assigned to you</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
