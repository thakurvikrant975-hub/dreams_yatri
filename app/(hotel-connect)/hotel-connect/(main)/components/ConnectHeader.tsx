import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import UserMenu from "./UserMenu";

export default async function ConnectHeader({
  title,
  badge,
}: {
  title?: string;
  badge?: string;
}) {
  const session = await hotelConnectAuth();
  const name = session?.user?.name ?? "Partner";
  const email = session?.user?.email ?? "";

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-100 bg-white sticky top-0 z-20 shrink-0">
      {/* Left: page title + optional badge */}
      <div className="flex items-center gap-2.5">
        {title && (
          <h1 className="text-sm font-semibold text-neutral-800">{title}</h1>
        )}
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
            {badge}
          </span>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-1">
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} weight="regular" />
        </button>

        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
