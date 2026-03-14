'use client'
import { FeatureCardProps } from "@/app/types/home";
import Card from "./Card";
import { Heading, Text } from "./Typography";

export default function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="px-6 py-5">
      <div className="size-14 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-center text-2xl mb-4 m-auto">
        <Icon className='size-7 text-(--text-muted)' />
      </div>
      <Heading level={3} weight='semibold'>{title}</Heading>
      <Text size='sm' intent='secondary' truncate={false} className="mt-1">{description}</Text>
    </Card>
  );
}