'use client'
import { ReviewCardProps } from "@/app/types/home";
import { StarIcon } from "@heroicons/react/24/solid";
import Card from "./Card";
import Image from "next/image";
import { Heading, Text } from "./Typography";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";

export default function ReviewCard({ review }: ReviewCardProps) {
    return (
        <Card className="px-6 py-5 aspect-video h-65.75">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-(--border-default)">
                <div className="flex items-center gap-3 w-full">
                    <Image src={review.profile} alt="review user image" width={36} height={36} className="size-9 rounded-full ring-offset-3 ring-[0.08em] ring-(--border-default) " />
                    {/* <div className="w-9 h-9 rounded-full bg-linear-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                       {review.name[0]}</div> */
                    }

                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex gap-2.5 justify-between items-center">
                            <Text weight='semibold' className="font-heading">{review.name}</Text>
                            <div className="flex items-center gap-1 shrink-0">
                                <StarIcon className="size-4.5 text-warning-500" />
                                <span className="text-warning-500 font-bold text-sm">{review.rating}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 justify-between w-full">
                            <Text size='xs' intent='secondary'>{review.package}</Text>
                            <div className="flex items-center gap-2">
                                <CalendarDaysIcon className='size-4 text-(--text-muted)' />
                                <Text size='xs' intent='secondary'>{review.date}</Text>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Text */}
            <Text intent='secondary' size='sm' truncate={false} className="leading-relaxed line-clamp-3 mb-4 mt-3">{review.text}</Text>

            {/* Images */}
            <div className="flex gap-2">
                {review.images.map((src, i) => (
                    <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-22 aspect-4/3 rounded-lg object-cover shrink-0"
                    />
                ))}
            </div>
        </Card>
    );
}