// Lightweight, dependency-free animated background for the Avanti AI section.
// Replaces the heavy three.js + WebGL bloom "neural network" canvas. Everything
// here animates via GPU-composited CSS (transform / opacity) — no render loop,
// no library — so it loads instantly and stays cheap to paint.
//
// Server component (no hooks / no client JS). Decorative only → aria-hidden.

// A small, hand-placed "neural" graph drawn in a 0–100 viewBox. Kept tiny on
// purpose: a handful of nodes + edges reads as a network without any cost.
const NODES = [
  { x: 12, y: 24 }, { x: 30, y: 62 }, { x: 22, y: 88 },
  { x: 48, y: 34 }, { x: 58, y: 74 }, { x: 72, y: 20 },
  { x: 80, y: 56 }, { x: 90, y: 84 }, { x: 66, y: 46 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 3], [3, 8], [8, 4], [4, 5],
  [5, 6], [8, 6], [6, 7], [4, 7], [1, 8], [3, 5],
];

// Twinkling particles — deterministic positions (no Math.random → no hydration
// mismatch). `d` staggers each particle's twinkle so they shimmer out of phase.
const PARTICLES = [
  { x: 8, y: 18, s: 2, d: 0 }, { x: 18, y: 70, s: 1.5, d: 0.6 },
  { x: 27, y: 40, s: 2, d: 1.2 }, { x: 38, y: 85, s: 1.5, d: 0.3 },
  { x: 44, y: 14, s: 2.5, d: 0.9 }, { x: 55, y: 52, s: 1.5, d: 1.5 },
  { x: 63, y: 28, s: 2, d: 0.4 }, { x: 70, y: 78, s: 1.5, d: 1.1 },
  { x: 78, y: 38, s: 2, d: 0.7 }, { x: 86, y: 64, s: 1.5, d: 0.2 },
  { x: 92, y: 22, s: 2.5, d: 1.3 }, { x: 50, y: 90, s: 1.5, d: 0.8 },
  { x: 34, y: 22, s: 1.5, d: 1.6 }, { x: 96, y: 46, s: 2, d: 0.5 },
];

export default function AvantiAuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* ── Drifting aurora glows (brand-tinted) ── */}
      <div
        className="absolute -top-1/4 -left-[10%] size-[55vw] max-w-3xl rounded-full blur-3xl animate-aurora-1"
        style={{ background: 'radial-gradient(circle at center, rgba(251,43,55,0.30), transparent 68%)' }}
      />
      <div
        className="absolute top-1/3 right-[-12%] size-[48vw] max-w-2xl rounded-full blur-3xl animate-aurora-2"
        style={{ background: 'radial-gradient(circle at center, rgba(255,107,115,0.22), transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-20%] left-1/3 size-[42vw] max-w-2xl rounded-full blur-3xl animate-aurora-3"
        style={{ background: 'radial-gradient(circle at center, rgba(196,21,32,0.25), transparent 72%)' }}
      />

      {/* ── Faint tech grid, slowly panning, masked to fade at the edges ── */}
      <div
        className="absolute inset-0 animate-grid-pan"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 85%)',
        }}
      />

      {/* ── Neural constellation — edges carry a flowing "data pulse" dash ── */}
      <svg
        className="absolute inset-0 h-full w-full opacity-50"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="rgba(255,140,145,0.18)"
            strokeWidth={0.18}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Flowing pulses ride on top of a subset of edges */}
        {EDGES.filter((_, i) => i % 2 === 0).map(([a, b], i) => (
          <line
            key={`flow-${i}`}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="rgba(251,43,55,0.7)"
            strokeWidth={0.35}
            strokeDasharray="4 22"
            vectorEffect="non-scaling-stroke"
            className="animate-dash-flow"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x} cy={n.y} r={0.9}
            fill="rgba(255,161,163,0.9)"
            className="animate-twinkle"
            style={{ animationDelay: `${(i % 5) * 0.5}s`, transformBox: 'fill-box', transformOrigin: 'center' }}
          />
        ))}
      </svg>

      {/* ── Twinkling particles ── */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.s}px`,
            height: `${p.s}px`,
            animationDelay: `${p.d}s`,
            boxShadow: '0 0 6px 1px rgba(255,255,255,0.35)',
          }}
        />
      ))}

      {/* ── Subtle top/bottom vignette so content stays legible ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
    </div>
  );
}
