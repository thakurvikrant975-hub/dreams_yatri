import Link from "next/link";

function KickSVG() {
    const c = "#111";
    const sw = 7;
    return (
        <svg width="380" height="210" viewBox="0 0 380 210" fill="none" xmlns="http://www.w3.org/2000/svg">

            {/* "!?" above kicked person's head */}
            <text x="148" y="36" fill={c} fontSize="26" fontWeight="900" fontFamily="sans-serif">!?</text>

            {/* ── Person being kicked (left, flying back) ── */}
            <circle cx="128" cy="62" r="20" fill="#FFA726" stroke={c} strokeWidth={sw}/>
            {/* Sunglasses */}
            <ellipse cx="120" cy="57" rx="9" ry="6" fill={c}/>
            <ellipse cx="136" cy="57" rx="9" ry="6" fill={c}/>
            <line x1="111" y1="57" x2="108" y2="57" stroke={c} strokeWidth="3" strokeLinecap="round"/>
            <line x1="129" y1="57" x2="127" y2="57" stroke={c} strokeWidth="3" strokeLinecap="round"/>
            <line x1="145" y1="57" x2="148" y2="57" stroke={c} strokeWidth="3" strokeLinecap="round"/>
            {/* Body tilted backward */}
            <line x1="130" y1="82"  x2="148" y2="148" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            {/* Arms thrown back */}
            <line x1="135" y1="105" x2="104" y2="80"  stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            <line x1="135" y1="105" x2="108" y2="140" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            {/* Legs flying */}
            <line x1="148" y1="148" x2="120" y2="188" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            <line x1="148" y1="148" x2="172" y2="185" stroke={c} strokeWidth={sw} strokeLinecap="round"/>

            {/* ── Impact zigzag ── */}
            <path d="M172,138 L184,152 L173,162 L186,176"
                stroke={c} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="165" y1="140" x2="157" y2="132" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="188" y1="140" x2="198" y2="132" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="164" y1="162" x2="156" y2="170" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="190" y1="173" x2="198" y2="180" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>

            {/* ── Kicker — police (right side) ── */}
            {/* Cap */}
            <rect x="243" y="29" width="44" height="9"  rx="2" fill={c}/>
            <rect x="249" y="20" width="32" height="12" rx="2" fill={c}/>
            {/* Head */}
            <circle cx="265" cy="68" r="20" fill="#FFA726" stroke={c} strokeWidth={sw}/>
            {/* Angry brows */}
            <line x1="255" y1="61" x2="262" y2="65" stroke={c} strokeWidth="3" strokeLinecap="round"/>
            <line x1="268" y1="65" x2="275" y2="61" stroke={c} strokeWidth="3" strokeLinecap="round"/>
            {/* Eyes */}
            <circle cx="258" cy="69" r="2.5" fill={c}/>
            <circle cx="272" cy="69" r="2.5" fill={c}/>
            {/* Frown */}
            <path d="M257,78 Q265,74 273,78" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
            {/* Body leaning into kick */}
            <line x1="265" y1="88"  x2="258" y2="150" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            {/* Arms */}
            <line x1="262" y1="114" x2="298" y2="94"  stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            <line x1="262" y1="114" x2="242" y2="148" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            {/* Standing leg */}
            <line x1="258" y1="150" x2="264" y2="207" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            {/* Kicking leg */}
            <line x1="258" y1="150" x2="230" y2="158" stroke={c} strokeWidth={sw} strokeLinecap="round"/>
            <line x1="230" y1="158" x2="175" y2="152" stroke={c} strokeWidth={sw} strokeLinecap="round"/>

            {/* Ground shadows */}
            <ellipse cx="140" cy="208" rx="30" ry="5" fill={c} opacity="0.15"/>
            <ellipse cx="268" cy="208" rx="28" ry="5" fill={c} opacity="0.15"/>
        </svg>
    );
}

export default function UnauthorizedPage() {
    return (
        <div className="-m-6 flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-[#FFA726] px-6 py-10">
            <div className="flex flex-col items-center gap-2 text-center">

                <p className="text-[120px] font-black leading-none tracking-tighter text-white select-none">
                    401
                </p>
                <p className="text-2xl font-semibold text-white/90 -mt-2">
                    Authorization required.
                </p>

                <div className="mt-2">
                    <KickSVG />
                </div>

                <p className="text-white/80 text-sm max-w-xs leading-relaxed">
                    You don&apos;t have permission to view this page. Contact your admin if you think this is a mistake.
                </p>

                <div className="flex items-center gap-3 mt-5">
                    <Link
                        href="/dashboard"
                        className="rounded-full bg-white px-7 py-2.5 text-sm font-semibold text-[#FFA726] hover:bg-white/90 transition-colors"
                    >
                        Go to Dashboard
                    </Link>
                    <Link
                        href="/dashboard/login"
                        className="rounded-full border-2 border-white px-7 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                        Switch Account
                    </Link>
                </div>
            </div>
        </div>
    );
}
