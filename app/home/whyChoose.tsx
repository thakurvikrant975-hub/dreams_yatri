'use client'
import { motion } from "framer-motion";
import SectionHeader from "@/app/components/ui/SectionHeader";
import FeatureCard from "@/app/components/ui/FeatureCard";
import { FeatureCardProps } from "@/app/types/home";
import { Cog8ToothIcon, UsersIcon, ClockIcon, CurrencyRupeeIcon } from "@heroicons/react/24/solid";
import { staggerContainer, staggerItemZoom } from "@/app/lib/motionPresets";

const FEATURES: FeatureCardProps[] = [
  {
    icon: Cog8ToothIcon,
    title: "100% Customizable",
    description: "Every trip built from scratch — your dates, budget, interests, and pace.",
  },
  {
    icon: UsersIcon,
    title: "Local Destination Experts",
    description: "On-ground specialists who know every road, stay, and hidden gem.",
  },
  {
    icon: ClockIcon,
    title: "24×7 Support",
    description: "Real humans available round the clock — before, during, and after travel.",
  },
  {
    icon: CurrencyRupeeIcon,
    title: "Transparent Pricing",
    description: "No hidden charges. No surprise bills. What you see is exactly what you pay.",
  },
];

export default function WhyChooseUsSection() {
  return (
    <section className="py-section">
      <div className="screen-space">

        <SectionHeader
          noAnimation
          tag="WHY CHOOSE US"
          title="The Dreams Yatri Difference"
          subtitle="Everything we do is built around one thing — making your journey extraordinary."
        />

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer(0.1, 0.05)}
        >
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={staggerItemZoom}>
              <FeatureCard
                title={feature.title}
                icon={feature.icon}
                description={feature.description}
              />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}