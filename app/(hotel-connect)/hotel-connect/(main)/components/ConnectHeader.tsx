import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { Bell, CaretDown } from "@phosphor-icons/react/dist/ssr";

export default async function ConnectHeader({
  title,
  badge,
}: {
  title?: string;
  badge?: string;
}) {
  const session = await hotelConnectAuth();
  const name = session?.user?.name ?? "Partner";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-white sticky top-0 z-10">
      {/* Left: page title + optional badge */}
      <div className="flex items-center gap-2.5">
        {title && (
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        )}
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
            {badge}
          </span>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-3">
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
          <Bell size={18} weight="regular" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-100 cursor-pointer group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs text-gray-400 leading-none mb-0.5">Hi,</p>
            <p className="text-sm font-semibold text-gray-800 leading-none">{name}</p>
          </div>
          <CaretDown size={14} className="text-gray-400 ml-1" />
        </div>
      </div>
    </header>
  );
}
