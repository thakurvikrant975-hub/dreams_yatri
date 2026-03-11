import { SectionHeaderProps } from "@/app/types/home";

export default function SectionHeader({ tag, tagColor = "text-rose-500", title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-10">
      <p className={`text-sm font-semibold mb-2 ${tagColor}`}>{tag}</p>
      <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-slate-500 text-base max-w-xl">{subtitle}</p>
      )}
    </div>
  );
}