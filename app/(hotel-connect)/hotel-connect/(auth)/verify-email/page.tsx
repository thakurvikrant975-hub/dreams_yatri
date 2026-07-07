import Link from "next/link";
import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { verifyOwnerEmail } from "./actions";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyOwnerEmail(token) : { ok: false, error: "Missing verification token." };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
        {result.ok ? (
          <>
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircleIcon size={28} weight="fill" className="text-emerald-500" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Email verified</h1>
            <p className="text-sm text-neutral-500 mb-6">
              Your email address is confirmed. You&apos;re all set to publish your property.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50">
              <XCircleIcon size={28} weight="fill" className="text-red-500" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 mb-1.5">Verification failed</h1>
            <p className="text-sm text-neutral-500 mb-6">{result.error}</p>
          </>
        )}
        <Link
          href="/hotel-connect"
          className="inline-flex items-center justify-center w-full h-10 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
