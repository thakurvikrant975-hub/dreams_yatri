import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import SignupForm from "./SignupForm";

export default async function HotelConnectSignupPage() {
  const session = await hotelConnectAuth();
  if (session) redirect("/hotel-connect");

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-10">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #fff7ed 0%, #ffedd5 30%, #fef3c7 60%, #f0fdf4 100%)",
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fdba74 0.8px, transparent 0.8px)",
          backgroundSize: "30px 30px",
          opacity: 0.15,
        }}
      />

      {/* Decorative cards */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            top: "8%",
            left: "4%",
            animation: "floatCard 7s ease-in-out infinite",
            opacity: 0.5,
          }}
        >
          <div className="bg-white rounded-2xl p-3 shadow-md w-28">
            <div className="w-full h-10 bg-orange-100 rounded-lg mb-2" />
            <div className="h-1.5 bg-gray-200 rounded w-3/4 mb-1" />
            <div className="h-1.5 bg-orange-200 rounded w-1/2" />
          </div>
        </div>
        <div
          className="absolute"
          style={{
            bottom: "15%",
            right: "5%",
            animation: "floatCard 9s ease-in-out infinite",
            animationDelay: "-4s",
            opacity: 0.4,
          }}
        >
          <div className="bg-white rounded-2xl p-3 shadow-md w-24">
            <div className="w-full h-8 bg-amber-100 rounded-lg mb-2" />
            <div className="h-1.5 bg-gray-200 rounded w-full mb-1" />
            <div className="h-1.5 bg-amber-200 rounded w-2/3" />
          </div>
        </div>
      </div>

      <SignupForm />

      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-14px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}
