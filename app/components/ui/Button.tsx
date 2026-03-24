import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'rounded-button flex items-center justify-center gap-2 font-medium transition duration-200 cursor-pointer active:scale-95 disabled:pointer-events-none relative z-10',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-inverse hover:bg-primary-500',
        premium: 'bg-gradient-to-r from-primary-400 to-primary-600 text-white hover:from-primary-500 hover:to-primary-700 focus:ring-primary-500 ',
        secondary:
          'bg-neutral-600/80 text-white hover:bg-neutral-700 focus:ring-neutral-500 disabled:bg-neutral-300',
        outline:
          'bg-white text-(--text-secondary) shadow-md shadow-neutral-200 ring-1 ring-inset ring-(--border-default) hover:bg-neutral-50',
        error:
          'bg-error-500 hover:error-400 text-white shadow-md shadow-error-300/40',
        success:
          'bg-success-500 hover:success-400 text-white shadow-md shadow-success-300/40',
        warning:
          'bg-warning-500 hover:warning-400 text-white shadow-md shadow-warning-300/40',
        ghost:
          'text-error-600 hover:bg-error-50 focus:ring-error-500 disabled:text-error-300',
        custom: 'shadow-md',
      },
      size: {
        xs: 'px-2.5 py-1.5 text-sm',
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-5 py-3 text-base',
        auto: '',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-50',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  Omit<VariantProps<typeof buttonVariants>, 'disabled'> {
  loading?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant,
  size,
  loading = false,
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      className={buttonVariants({ variant, size, disabled: isDisabled, className })}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      )}
      {children}
    </button>
  );
};

export { Button, buttonVariants };
export default Button;