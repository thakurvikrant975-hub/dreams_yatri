import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import ResendVerificationLink from "./ResendVerificationLink";

export default function EmailVerifyBanner() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm">
      <WarningCircleIcon size={16} weight="fill" className="shrink-0 text-amber-500 mt-0.5" />
      <div>
        <p className="font-medium text-amber-800">Your account email isn&apos;t verified yet</p>
        <p className="text-xs text-amber-700 mt-0.5">
          This doesn&apos;t block anything — your listings can go live either way. Verify whenever it&apos;s convenient.
        </p>
        <ResendVerificationLink />
      </div>
    </div>
  );
}
