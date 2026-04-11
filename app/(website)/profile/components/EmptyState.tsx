type EmptyStateProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
      <div className="size-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-neutral-700 mb-1">
        {title}
      </p>
      <p className="text-xs text-neutral-400 max-w-[220px]">
        {description}
      </p>
    </div>
  );
}