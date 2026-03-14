'use client'
import { BlogCardProps } from "@/app/types/home";
import Image from "next/image";
import { Heading, Text } from "./Typography";
import Button from "./Button";

export default function BlogCard({ post, index }: BlogCardProps) {
    return (
        <div
            className={`group cursor-pointer transition-all duration-500`}
            style={{ transitionDelay: `${index * 80}ms` }}
        >
            {/* Image */}
            <div className="rounded-2xl overflow-hidden mb-4 aspect-4/3 bg-neutral-100">
                <Image
                    src={post.image}
                    alt={post.title}
                    width='1600'
                    height='1200'
                    className="w-full h-full"
                />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2.5 mb-2">
                <Text size='sm' intent='secondary'>{post.date}</Text>
                <span className="text-(--text-muted) ">•</span>
                <Text as='span' size='xs' intent='secondary' className="px-3 py-0.75 rounded-full bg-neutral-200/60">
                    {post.category}
                </Text>
            </div>

            <div className="space-y-3.5">
                <Heading level={3} truncate={false} className="line-clamp-2">
                    {post.title}
                </Heading>

                <Text size='sm' intent='secondary' >{post.excerpt}</Text>

                <Button variant='premium' size='sm'>
                    Read More
                </Button>
            </div>

        </div>
    );
}