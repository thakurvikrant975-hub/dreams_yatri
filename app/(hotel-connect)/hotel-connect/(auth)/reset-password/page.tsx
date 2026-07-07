import Link from "next/link";
import DyLogo from "@/app/components/ui/DyLogo";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 py-12">
      <div className="flex items-center gap-2 mb-10">
        <DyLogo className="h-6 text-primary-500" />
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded">
          CONNECT
        </span>
      </div>
      <div className="w-full max-w-sm">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50">
              <XCircleIcon size={28} weight="fill" className="text-red-500" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Invalid link</h1>
            <p className="text-sm text-neutral-500 mb-6">This password reset link is missing or malformed.</p>
            <Link href="/hotel-connect/forgot-password" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
