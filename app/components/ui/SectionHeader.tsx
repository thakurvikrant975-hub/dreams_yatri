import { SectionHeaderProps } from "@/app/types/home";
import { Heading, Text } from "./Typography";

export default function SectionHeader({ tag, title, subtitle, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="mb-10 flex gap-4">
      {Icon && <Icon className="size-12" />}
      <div>
        <Text size='sm' weight='medium' intent='brand'>{tag}</Text>

        <Heading level={2} className="mt-2">
          {title}
        </Heading>

        {subtitle && (
          <Text intent='secondary'>{subtitle}</Text>
        )}
      </div>
    </div>
  );
}