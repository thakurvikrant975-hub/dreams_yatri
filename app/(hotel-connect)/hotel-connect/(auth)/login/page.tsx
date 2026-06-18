import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import LoginForm from "./LoginForm";

export default async function HotelConnectLoginPage() {
  const session = await hotelConnectAuth();
  if (session) redirect("/hotel-connect");

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-8">
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

      {/* Decorative building silhouettes */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden">
        <svg
          viewBox="0 0 1440 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          style={{ opacity: 0.07 }}
        >
          {/* Left cluster */}
          <rect x="20" y="80" width="60" height="120" fill="#78350f" />
          <rect x="30" y="60" width="40" height="20" fill="#78350f" />
          <rect x="90" y="50" width="80" height="150" fill="#92400e" />
          <rect x="110" y="30" width="40" height="20" fill="#92400e" />
          <rect x="180" y="90" width="50" height="110" fill="#78350f" />

          {/* Right cluster */}
          <rect x="1300" y="70" width="70" height="130" fill="#78350f" />
          <rect x="1310" y="50" width="50" height="20" fill="#78350f" />
          <rect x="1240" y="40" width="50" height="160" fill="#92400e" />
          <rect x="1250" y="20" width="30" height="20" fill="#92400e" />
          <rect x="1380" y="95" width="60" height="105" fill="#78350f" />

          {/* Mid left */}
          <rect x="270" y="100" width="40" height="100" fill="#78350f" />
          <rect x="320" y="60" width="55" height="140" fill="#92400e" />
          <rect x="340" y="40" width="15" height="20" fill="#92400e" />
        </svg>
      </div>

      {/* Floating property cards (decorative) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            top: "12%",
            left: "6%",
            animation: "floatCard1 6s ease-in-out infinite",
            opacity: 0.6,
          }}
        >
          <div className="bg-white rounded-2xl p-3 shadow-lg w-32">
            <div className="w-full h-12 bg-orange-100 rounded-lg mb-2" />
            <div className="h-2 bg-gray-200 rounded w-3/4 mb-1" />
            <div className="h-2 bg-orange-200 rounded w-1/2" />
          </div>
        </div>
        <div
          className="absolute"
          style={{
            top: "20%",
            right: "7%",
            animation: "floatCard2 7s ease-in-out infinite",
            animationDelay: "-3s",
            opacity: 0.5,
          }}
        >
          <div className="bg-white rounded-2xl p-3 shadow-lg w-28">
            <div className="w-full h-10 bg-amber-100 rounded-lg mb-2" />
            <div className="h-2 bg-gray-200 rounded w-full mb-1" />
            <div className="h-2 bg-amber-200 rounded w-2/3" />
          </div>
        </div>
        <div
          className="absolute"
          style={{
            bottom: "25%",
            left: "8%",
            animation: "floatCard1 8s ease-in-out infinite",
            animationDelay: "-5s",
            opacity: 0.45,
          }}
        >
          <div className="bg-white rounded-2xl p-3 shadow-lg w-24">
            <div className="w-full h-8 bg-green-100 rounded-lg mb-2" />
            <div className="h-2 bg-gray-200 rounded w-full mb-1" />
            <div className="h-2 bg-green-200 rounded w-3/4" />
          </div>
        </div>
      </div>

      <LoginForm />

      <style>{`
        @keyframes floatCard1 {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes floatCard2 {
          0%, 100% { transform: translateY(0px) rotate(1deg); }
          50%       { transform: translateY(-16px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}
