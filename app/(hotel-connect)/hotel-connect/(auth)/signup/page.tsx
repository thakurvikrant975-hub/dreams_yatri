import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import SignupForm from "./SignupForm";
import DyLogo from "@/app/components/ui/DyLogo";
import { Buildings, ChartLineUp, Star, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

export default async function HotelConnectSignupPage() {
  const session = await hotelConnectAuth();
  if (session) redirect("/hotel-connect");

  return (
    <div className="min-h-screen flex">

      {/* ── Left: Brand panel ─────────────────────────────────── */}
      <div
        className="hidden lg:flex w-120 shrink-0 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(226,35,40,0.25) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <DyLogo className="h-7 text-white" />
            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/60 border border-white/20 px-1.5 py-0.5 rounded">
              CONNECT
            </span>
          </div>
        </div>

        {/* Value prop */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug mb-3">
              Start receiving bookings<br />in minutes
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Fill in your property details across 7 tabs. Once approved, your listing goes live to thousands of travellers.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: Buildings,   text: "7-step guided listing wizard" },
              { icon: ChartLineUp, text: "Set your own pricing & availability" },
              { icon: Star,        text: "Build reputation with guest reviews" },
              { icon: ShieldCheck, text: "Verified listing badge on approval" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/75">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={14} weight="fill" className="text-white/80" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/30">
          © {new Date().getFullYear()} DreamsYatri. All rights reserved.
        </p>
      </div>

      {/* ── Right: Form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-start bg-white px-6 py-12 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8 self-start">
          <DyLogo className="h-6 text-primary-500" />
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-primary-500 bg-primary-50 px-1.5 py-0.5 rounded">
            CONNECT
          </span>
        </div>

        <div className="w-full max-w-md">
          <SignupForm />
        </div>
      </div>

    </div>
  );
}
