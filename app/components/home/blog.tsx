'use client'
import { BlogPost, BlogCardProps } from "@/app/types/home";
import useScrollVisible from "@/app/hooks/useScrollVisible";
import SectionHeader from "../ui/SectionHeader";

const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop",
  },
  {
    id: 2,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop",
  },
  {
    id: 3,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?w=600&h=400&fit=crop",
  },
  {
    id: 4,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?w=600&h=400&fit=crop",
  },
  {
    id: 5,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
  },
  {
    id: 6,
    date: "March 25, 2026",
    category: "Travel",
    title: "How Dreams Yatri Make Your Tour Enjoyable",
    excerpt: "Dreams Yatri help everyone to reach everyone there awaited destinations with personalized care and expert guidance.",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=400&fit=crop",
  },
];

function BlogCard({ post, visible, index }: BlogCardProps) {
  return (
    <div
      className={`group cursor-pointer transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Image */}
      <div className="rounded-2xl overflow-hidden mb-4 aspect-4/3 bg-slate-100">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400 text-xs">{post.date}</span>
        <span className="text-slate-300 text-xs">·</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {post.category}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-bold text-slate-900 text-base leading-snug mb-2 group-hover:text-rose-500 transition-colors">
        {post.title}
      </h3>

      {/* Excerpt */}
      <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>

      {/* CTA */}
      <button
        type="button"
        className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-full transition-colors"
      >
        Read More
      </button>
    </div>
  );
}


export default function BlogsSection() {
  const { ref, visible } = useScrollVisible();

  return (
    <section ref={ref} className="py-section">
      <div className="screen-space">
        <div
          className={`transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <SectionHeader
            tag="Real journeys. Real memories."
            title="Explore Blogs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {BLOG_POSTS.map((post, i) => (
            <BlogCard
              key={post.id}
              post={post}
              visible={visible}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}