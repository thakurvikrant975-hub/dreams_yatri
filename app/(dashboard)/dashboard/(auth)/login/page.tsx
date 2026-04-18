import { redirect } from "next/navigation";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import LoginForm from "./LoginForm";

// ── SVG Components ──────────────────────────────────────────────

function HotAirBalloon({
  color1,
  color2,
  color3,
  size = 80,
  style,
}: {
  color1: string;
  color2: string;
  color3: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 80 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <ellipse cx="40" cy="40" rx="36" ry="38" fill={color1} opacity="0.9" />
      <path
        d="M40 2 Q60 20 60 40 Q60 60 40 78 Q20 60 20 40 Q20 20 40 2Z"
        fill={color2}
        opacity="0.6"
      />
      <path
        d="M40 2 Q30 20 28 40 Q30 60 40 78 Q50 60 52 40 Q50 20 40 2Z"
        fill={color3}
        opacity="0.5"
      />
      <ellipse cx="28" cy="22" rx="8" ry="10" fill="white" opacity="0.28" />
      <line x1="28" y1="76" x2="24" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="52" y1="76" x2="56" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="36" y1="78" x2="30" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <line x1="44" y1="78" x2="50" y2="94" stroke="#78350f" strokeWidth="1.5" />
      <rect x="22" y="94" width="36" height="16" rx="3" fill="#78350f" />
      <rect x="24" y="96" width="32" height="12" rx="2" fill="#92400e" />
      <line x1="32" y1="96" x2="32" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="40" y1="96" x2="40" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="48" y1="96" x2="48" y2="108" stroke="#78350f" strokeWidth="1" />
      <line x1="24" y1="102" x2="56" y2="102" stroke="#78350f" strokeWidth="1" />
    </svg>
  );
}

function Cloud({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="160"
      height="70"
      viewBox="0 0 160 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <ellipse cx="80" cy="50" rx="75" ry="20" fill="#b8cfe0" opacity="0.45" />
      <ellipse cx="55" cy="42" rx="40" ry="26" fill="#c4d8e8" opacity="0.4" />
      <ellipse cx="108" cy="38" rx="34" ry="22" fill="#c4d8e8" opacity="0.4" />
      <ellipse cx="80" cy="32" rx="28" ry="20" fill="#d0e2ee" opacity="0.35" />
    </svg>
  );
}

function Birds({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="80"
      height="30"
      viewBox="0 0 80 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path d="M0 15 Q5 8 10 15" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.55" />
      <path d="M15 10 Q20 3 25 10" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.45" />
      <path d="M30 18 Q35 11 40 18" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.55" />
      <path d="M50 8 Q55 1 60 8" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.35" />
      <path d="M65 14 Q70 7 75 14" stroke="#6b7280" strokeWidth="1.5" fill="none" opacity="0.45" />
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default async function LoginPage() {
const session = await dashboardAuth();
if (session) redirect("/dashboard");

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center py-8">

      {/* Sky Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(170deg, #dce8f5 0%, #e8eff7 35%, #eff4f8 60%, #f4f5f3 80%, #edecea 100%)",
        }}
      />

      {/* Dot grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #9db4c8 0.8px, transparent 0.8px)",
          backgroundSize: "28px 28px",
          opacity: 0.18,
        }}
      />

      {/* Clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Cloud
          style={{
            position: "absolute",
            top: "8%",
            left: "-5%",
            animation: "driftCloud1 42s linear infinite",
          }}
        />
        <Cloud
          style={{
            position: "absolute",
            top: "22%",
            left: "-8%",
            animation: "driftCloud2 56s linear infinite",
            animationDelay: "-22s",
            transform: "scale(0.7)",
          }}
        />
        <Cloud
          style={{
            position: "absolute",
            top: "55%",
            left: "-6%",
            animation: "driftCloud1 50s linear infinite",
            animationDelay: "-38s",
            transform: "scale(1.1)",
          }}
        />
        <Cloud
          style={{
            position: "absolute",
            top: "5%",
            right: "-4%",
            animation: "driftCloud3 47s linear infinite",
            animationDelay: "-12s",
          }}
        />
      </div>

      {/* Birds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Birds
          style={{
            position: "absolute",
            top: "14%",
            left: "-10%",
            animation: "flyBirds 36s linear infinite",
            animationDelay: "-5s",
          }}
        />
        <Birds
          style={{
            position: "absolute",
            top: "38%",
            left: "-10%",
            animation: "flyBirds 46s linear infinite",
            animationDelay: "-28s",
            transform: "scale(0.6)",
          }}
        />
      </div>

      {/* Hot Air Balloons */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "0%",
            animation: "floatBalloon1 18s ease-in-out infinite",
          }}
        >
          <HotAirBalloon color1="#ef4444" color2="#fbbf24" color3="#f97316" size={110} />
        </div>
        <div
          style={{
            position: "absolute",
            right: "8%",
            top: "10%",
            animation: "floatBalloon2 22s ease-in-out infinite",
            animationDelay: "-8s",
          }}
        >
          <HotAirBalloon color1="#8b5cf6" color2="#ec4899" color3="#a78bfa" size={85} />
        </div>
        <div
          style={{
            position: "absolute",
            left: "20%",
            top: "5%",
            animation: "floatBalloon3 20s ease-in-out infinite",
            animationDelay: "-14s",
          }}
        >
          <HotAirBalloon color1="#10b981" color2="#06b6d4" color3="#34d399" size={65} />
        </div>
        <div
          style={{
            position: "absolute",
            right: "22%",
            top: "2%",
            animation: "floatBalloon1 25s ease-in-out infinite",
            animationDelay: "-5s",
          }}
        >
          <HotAirBalloon color1="#f59e0b" color2="#fbbf24" color3="#fb923c" size={55} />
        </div>
        <div
          style={{
            position: "absolute",
            left: "45%",
            top: "-2%",
            animation: "floatBalloon2 16s ease-in-out infinite",
            animationDelay: "-3s",
          }}
        >
          <HotAirBalloon color1="#3b82f6" color2="#a855f7" color3="#60a5fa" size={45} />
        </div>
      </div>

      {/* Horizon warm glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(251,191,36,0.08), transparent)",
        }}
      />

      {/* ✅ LoginForm — direct flex child, gets centered by parent */}
      <LoginForm />

      {/* Animations */}
      <style>{`
        @keyframes floatBalloon1 {
          0%   { transform: translateY(0px) rotate(-1deg); }
          25%  { transform: translateY(-22px) rotate(1deg); }
          50%  { transform: translateY(-10px) rotate(-0.5deg); }
          75%  { transform: translateY(-28px) rotate(1.5deg); }
          100% { transform: translateY(0px) rotate(-1deg); }
        }
        @keyframes floatBalloon2 {
          0%   { transform: translateY(0px) rotate(1deg); }
          30%  { transform: translateY(-18px) rotate(-1deg); }
          60%  { transform: translateY(-32px) rotate(0.5deg); }
          100% { transform: translateY(0px) rotate(1deg); }
        }
        @keyframes floatBalloon3 {
          0%   { transform: translateY(0px); }
          40%  { transform: translateY(-26px) rotate(-1.5deg); }
          70%  { transform: translateY(-14px) rotate(1deg); }
          100% { transform: translateY(0px); }
        }
        @keyframes driftCloud1 {
          0%   { transform: translateX(-220px); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(110vw); opacity: 0; }
        }
        @keyframes driftCloud2 {
          0%   { transform: translateX(-220px) scale(0.7); opacity: 0; }
          5%   { opacity: 0.9; }
          95%  { opacity: 0.9; }
          100% { transform: translateX(110vw) scale(0.7); opacity: 0; }
        }
        @keyframes driftCloud3 {
          0%   { transform: translateX(110vw); opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { transform: translateX(-220px); opacity: 0; }
        }
        @keyframes flyBirds {
          0%   { transform: translateX(-200px) translateY(0px); opacity: 0; }
          5%   { opacity: 1; }
          50%  { transform: translateX(50vw) translateY(-30px); }
          95%  { opacity: 1; }
          100% { transform: translateX(110vw) translateY(-10px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}