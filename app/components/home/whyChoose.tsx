"use client";
import { FeatureCardProps, Feature } from "@/app/types/home";
import useScrollVisible from "@/app/hooks/useScrollVisible";
import SectionHeader from "../ui/SectionHeader";

const FEATURES: Feature[] = [
  {
    icon: "⚙️",
    title: "100% Customizable",
    description: "Every trip built from scratch — your dates, budget, interests, and pace.",
  },
  {
    icon: "🧭",
    title: "Local Destination Experts",
    description: "On-ground specialists who know every road, stay, and hidden gem.",
  },
  {
    icon: "🕐",
    title: "24×7 Support",
    description: "Real humans available round the clock — before, during, and after travel.",
  },
  {
    icon: "💳",
    title: "Transparent Pricing",
    description: "No hidden charges. No surprise bills. What you see is exactly what you pay.",
  },
];

function FeatureCard({ feature, visible, index }: FeatureCardProps) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${index * 100}ms`, transitionDuration: "600ms" }}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl mb-4">
        {feature.icon}
      </div>
      <h3 className="font-bold text-slate-900 text-base mb-2">{feature.title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>
    </div>
  );
}

export default function WhyChooseUsSection() {
  const { ref, visible } = useScrollVisible();

  return (
    <section
      ref={ref}
      className="py-20 lg:py-24 bg-slate-50"
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div
          className={`transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <SectionHeader
            tag="WHY CHOOSE US"
            title="The Dreams Yatri Difference"
            subtitle="Everything we do is built around one thing — making your journey extraordinary."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              visible={visible}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
