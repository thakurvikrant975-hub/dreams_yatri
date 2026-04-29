"use client";

import React from "react";

const Hero = ({ children, className = "" }:{children: React.ReactNode, className?: string}) => {
  return (
    <>
    <section
      className={`relative bg-gray-950 overflow-hidden ${className}`}
      style={{ paddingTop: "88px", paddingBottom: "72px" }}
    >
      {/* Grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />

      {/* Red glow blobs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-red-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-red-500/10 blur-[70px] pointer-events-none" />

      {/* Decorative question mark */}
      <div className="absolute right-8 sm:right-20 top-1/2 -translate-y-1/2 pointer-events-none select-none">
        <span
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(120px, 18vw, 240px)",
            fontWeight: 800,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.025)",
            lineHeight: 1,
          }}
        >
          ?
        </span>
      </div>

      {/* Content wrapper */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
        {children}
      </div>
    </section>

          {/* Wave */}
      <svg className="block -mt-px bg-white" viewBox="0 0 1200 56" preserveAspectRatio="none" height="56" width="100%">
        <path d="M0 0 Q300 56 600 28 Q900 0 1200 38 L1200 0 Z" fill="#030712" />
      </svg>

    </>
  );
};

export default Hero;