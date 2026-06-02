import { ImageResponse } from "next/og";
import { SITE_CONFIG } from "@/app/lib/seo/site-config";

export const runtime = "edge";
export const alt     = "Travel Stories & Blogs | DreamsYatri";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function BlogsOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background: "linear-gradient(135deg, #0f0f0f 0%, #1a0505 50%, #2d0808 100%)",
          padding: "64px",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: "40%",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.07)",
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Brand pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 100,
            padding: "8px 20px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ef4444",
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#ef4444",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {SITE_CONFIG.name}
          </span>
        </div>

        {/* Heading */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            marginBottom: 20,
          }}
        >
          Travel Stories
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 400,
            marginBottom: 48,
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Real journeys. Real memories. Shared by travellers like you.
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 24,
            width: "100%",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              color: "white",
              fontWeight: 800,
            }}
          >
            ✈
          </div>
          <span
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.06em",
            }}
          >
            {SITE_CONFIG.url.replace("https://", "")}
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
