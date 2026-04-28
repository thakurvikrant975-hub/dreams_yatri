"use client";

export default function HeroTitle({
    children,
    highlight,
    paragraph,
    highlightColor = "#EF4444"
}) {
    return (
        <>
            <h1
                style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                    fontWeight: 800,
                    color: "#fff",
                    lineHeight: 1.1,
                    margin: "0 0 16px",
                    animation: "hero-rise 0.55s ease 0.08s both",
                }}
            >
                {children}{" "}
                {highlight && (
                    <span style={{ color: highlightColor, fontStyle: "italic" }}>
                        {highlight}
                    </span>
                )}
            </h1>

            <p className="text-gray-400 leading-relaxed mb-8"
                style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.05rem)", maxWidth: "480px", animation: "hero-rise 0.55s ease 0.16s both" }}>
                {paragraph}
            </p>
        </>
    );
}