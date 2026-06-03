'use client'

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SectionHeader from "@/app/components/ui/SectionHeader";
import { BlogCard } from "@/app/(website)/blogs/BlogCard";
import { staggerContainer, staggerItem } from "@/app/lib/motionPresets";
import type { PublishedBlogItem } from "@/app/actions/blogs/public";

interface BlogsSectionProps {
  posts: PublishedBlogItem[];
}

export default function BlogsSection({ posts }: BlogsSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section className="py-section bg-(--bg-page)">
      <div className="screen-space">

        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <SectionHeader
            noAnimation
            tag="Real journeys. Real memories."
            title="Travel Stories"
            subtitle="Discover destinations, tips, and first-hand experiences."
          />
          <Link
            href="/blogs"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:gap-3 transition-all shrink-0"
          >
            View all Blogs <ArrowRight className="size-4" />
          </Link>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7"
          variants={staggerContainer(0.09, 0.05)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {posts.map((post) => (
            <motion.div key={post.id} variants={staggerItem}>
              <BlogCard post={post} />
            </motion.div>
          ))}
        </motion.div>

        {/* Mobile "view all" */}
        <div className="mt-8 flex justify-center sm:hidden">
          <Link
            href="/blogs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600"
          >
            View all Blogs <ArrowRight className="size-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}
