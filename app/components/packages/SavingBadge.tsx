// SavingsBadge.tsx
import { cn } from "@/app/lib/utils";

interface SavingsBadgeProps {
  amount: string | number;
  className?: string;
  formatter?: (val: string | number) => string;
}

const LEFT_ZIGZAG = (fill: string) => (
  <svg width="8" className="h-full" viewBox="0 0 8 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.122702 2.76817L5.30177 0.391188L5.24993 5.18586L0.122702 2.76817Z"  fill={fill} />
    <path d="M0.0687989 7.97813L5.2477 5.60128L5.19619 10.3959L0.0687989 7.97813Z"  fill={fill} />
    <path d="M0.0168407 13.2093L5.15504 10.8L5.18508 15.5947L0.0168407 13.2093Z"    fill={fill} />
    <path d="M0.0687989 18.4127L5.2477 16.0358L5.19619 20.8305L0.0687989 18.4127Z"  fill={fill} />
    <path d="M0.0687989 23.63L5.2477 21.2531L5.19619 26.0478L0.0687989 23.63Z"      fill={fill} />
    <path d="M0.0687989 28.8473L5.2477 26.4704L5.19619 31.2651L0.0687989 28.8473Z"  fill={fill} />
  </svg>
);

const RIGHT_ZIGZAG = (fill: string) => (
  <svg width="9" className="h-full" viewBox="0 0 9 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.96176 2.73853L1.9868 0.387159L2.04623 5.13042L7.96176 2.73853Z"    fill={fill} />
    <path d="M8.02133 7.89331L2.04637 5.54194L2.1058 10.2852L8.02133 7.89331Z"     fill={fill} />
    <path d="M8.08053 13.0683L2.15252 10.6849L2.11787 15.4282L8.08053 13.0683Z"    fill={fill} />
    <path d="M8.02133 18.2161L2.04637 15.8647L2.1058 20.608L8.02133 18.2161Z"      fill={fill} />
    <path d="M8.02133 23.3774L2.04637 21.0261L2.1058 25.7693L8.02133 23.3774Z"     fill={fill} />
    <path d="M8.02133 28.5386L2.04637 26.1872L2.1058 30.9305L8.02133 28.5386Z"     fill={fill} />
  </svg>
);

// ─── Variant config ───────────────────────────────────────────────────────────

const variants = {
  success: {
    bg:       'bg-success-200',
    zigzag:   '#B9F8CF',
    text:     'text-success-700/85',
  },
  primary: {
    bg:       'bg-primary-200/80',
    zigzag:   'var(--color-primary-200)',
    text:     'text-primary-700/85',
  },
  warning: {
    bg:       'bg-warning-200/80',
    zigzag:   'var(--color-warning-200)',
    text:     'text-warning-700/85',
  },
  error: {
    bg:       'bg-error-200/80',
    zigzag:   'var(--color-error-200)',
    text:     'text-error-700/85',
  },
} as const;

type BadgeVariant = keyof typeof variants;

interface SavingsBadgeProps {
  amount: string | number;
  prefix?: string;           // default: 'Save '
  variant?: BadgeVariant;    // default: 'success'
  className?: string;
  formatter?: (val: string | number) => string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SavingsBadge({
  amount,
  prefix = 'Save ',
  variant = 'success',
  className,
  formatter,
}: SavingsBadgeProps) {
  const { bg, zigzag, text } = variants[variant];
  const display = formatter ? formatter(amount) : amount;

  return (
    <div className={cn('relative px-1.5 py-2 leading-none', bg, className)}>

      {/* Left serrated edge */}
      <div className="absolute h-full right-full top-0 translate-x-0.75">
        {LEFT_ZIGZAG(zigzag)}
      </div>

      {/* Right serrated edge */}
      <div className="absolute h-full left-full top-0 -translate-x-0.75">
        {RIGHT_ZIGZAG(zigzag)}
      </div>

      {/* Label */}
      <span className={cn(
        'text-[10px] font-heading font-semibold h-max block whitespace-nowrap',
        text
      )}>
        {prefix}{display}
      </span>

    </div>
  );
}

export default SavingsBadge;