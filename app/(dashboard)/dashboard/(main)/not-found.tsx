import Link from "next/link";

function CatSVG() {
    return (
        <svg width="240" height="188" viewBox="0 0 240 188" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Left ear */}
            <polygon points="50,88 38,30 86,72" fill="#A09A95"/>
            <polygon points="54,82 45,45 80,70" fill="#E8A090" opacity="0.7"/>
            {/* Right ear */}
            <polygon points="158,88 190,30 142,72" fill="#A09A95"/>
            <polygon points="154,82 183,45 148,70" fill="#E8A090" opacity="0.7"/>
            {/* Head */}
            <circle cx="118" cy="98" r="70" fill="#A09A95"/>
            {/* Muzzle */}
            <ellipse cx="118" cy="123" rx="32" ry="23" fill="#B8B3AE"/>
            {/* Left eye */}
            <ellipse cx="91"  cy="90" rx="17" ry="14" fill="#C88018"/>
            <ellipse cx="92"  cy="90" rx="8"  ry="13" fill="#111"/>
            <circle  cx="95"  cy="84" r="4"             fill="white" opacity="0.65"/>
            {/* Right eye */}
            <ellipse cx="143" cy="90" rx="17" ry="14" fill="#C88018"/>
            <ellipse cx="144" cy="90" rx="8"  ry="13" fill="#111"/>
            <circle  cx="147" cy="84" r="4"             fill="white" opacity="0.65"/>
            {/* Nose */}
            <polygon points="118,113 111,120 125,120" fill="#E07080"/>
            {/* Mouth */}
            <path d="M118,120 Q110,128 105,125" stroke="#777" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path d="M118,120 Q126,128 131,125" stroke="#777" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            {/* Whiskers left */}
            <line x1="109" y1="118" x2="62"  y2="111" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            <line x1="109" y1="123" x2="60"  y2="123" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            <line x1="109" y1="128" x2="64"  y2="135" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            {/* Whiskers right */}
            <line x1="127" y1="118" x2="174" y2="111" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            <line x1="127" y1="123" x2="176" y2="123" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            <line x1="127" y1="128" x2="172" y2="135" stroke="#999" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            {/* Left paw */}
            <ellipse cx="48"  cy="175" rx="30" ry="18" fill="#A09A95"/>
            <ellipse cx="34"  cy="168" rx="9"  ry="7"  fill="#938E8A"/>
            <ellipse cx="48"  cy="165" rx="9"  ry="7"  fill="#938E8A"/>
            <ellipse cx="62"  cy="168" rx="9"  ry="7"  fill="#938E8A"/>
            {/* Right paw */}
            <ellipse cx="190" cy="175" rx="30" ry="18" fill="#A09A95"/>
            <ellipse cx="176" cy="168" rx="9"  ry="7"  fill="#938E8A"/>
            <ellipse cx="190" cy="165" rx="9"  ry="7"  fill="#938E8A"/>
            <ellipse cx="204" cy="168" rx="9"  ry="7"  fill="#938E8A"/>
        </svg>
    );
}

export default function DashboardNotFound() {
    return (
        <div className="flex min-h-[72vh] flex-col items-center justify-center px-4 text-center">

            {/* 404 with cat overlaid */}
            <div className="relative flex items-center justify-center">
                <span className="text-[170px] font-black leading-none tracking-tighter select-none pointer-events-none text-dashboard-base-300/50">
                    404
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                    <CatSVG />
                </div>
            </div>

            <h1 className="mt-3 text-2xl font-bold text-dashboard-base-content">
                You came to the wrong neighborhood
            </h1>
            <p className="mt-1 text-sm text-dashboard-neutral">(we all make mistakes)</p>

            <div className="mt-4 h-px w-20 bg-dashboard-base-300" />

            <Link
                href="/dashboard"
                className="mt-5 rounded-full border-2 border-red-500 px-8 py-2.5 text-sm font-semibold uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-colors"
            >
                I was just leaving
            </Link>
        </div>
    );
}
