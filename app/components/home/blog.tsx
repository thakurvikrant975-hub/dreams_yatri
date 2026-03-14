'use client'

import { motion } from "framer-motion";
import { BlogPost } from "@/app/types/home";
import SectionHeader from "../ui/SectionHeader";
import BlogCard from "../ui/BlogCard";
import { staggerContainer, staggerItem } from "@/app/lib/motionPresets";

const BLOG_POSTS: BlogPost[] = [
  { id: 1, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop" },
  { id: 2, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop" },
  { id: 3, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=600&h=400&fit=crop" },
  { id: 4, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=600&h=400&fit=crop" },
  { id: 5, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop" },
  { id: 6, date: "March 25, 2026", category: "Travel", title: "How Dreams Yatri Make Your Tour Enjoyable", excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.", image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=400&fit=crop" },
];

export default function BlogsSection() {
  return (
    <section className="py-section">
      <div className="screen-space">

        <SectionHeader
          tag="Real journeys. Real memories."
          title="Explore Blogs"
        />

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7"
          variants={staggerContainer(0.09, 0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
        >
          {BLOG_POSTS.map((post, i) => (
            <motion.div key={post.id} variants={staggerItem}>
              <BlogCard post={post} index={i} />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}