'use client'
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
  'rounded-button flex items-center justify-center gap-2 font-medium transition duration-200 cursor-pointer active:scale-95 disabled:pointer-events-none relative z-10',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-500 text-inverse hover:bg-primary-400',
        premium: 'bg-gradient-to-r from-primary-400 to-primary-600 text-white hover:from-primary-500 hover:to-primary-700 focus:ring-primary-500 ',
        secondary:
          'bg-gray-600/80 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
        outline:
          'bg-linear-to-b dark:bg-linear-to-t text-gray-500 dark:text-zinc-500 from-white via-gray-50 to-gray-100 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 dark:text-zinc-300/80 dark:hover:bg-zinc-700 shadow-md shadow-gray-200 dark:shadow-zinc-700/40 ring-1 ring-inset ring-gray-300 hover:ring-gray-400/80 dark:ring-zinc-700 dark:ring-zinc-600 after:absolute after:inset-[0.2em] after:-z-10 after:bg-linear-to-b after:from-gray-300/50 after:via-gray-100/10 after:to-gray-100/5 dark:after:from-zinc-600/70 dark:after:via-zinc-800/10 dark:after:to-zinc-800/5 after:rounded-[inherit] after:h-1/2',
        error:
          'bg-white bg-linear-to-b from-error-600/85 via-error-600/75 dark:from-error-600 dark:via-error-600/85 to-error-400 hover:from-error-500 hover:via-error-500 hover:to-error-400/80 text-white shadow-md shadow-error-300/40 after:absolute after:inset-[0.15em] after:bg-linear-to-b after:from-error-300/50 after:via-error-100/10 after:to-error-300/5 after:rounded-[inherit] after:h-1/2',
        success:
          'bg-white bg-linear-to-b from-success-600/85 via-success-600/75 dark:from-success-600 dark:via-success-600/85 to-success-400 hover:from-success-500 hover:via-success-500 hover:to-success-400/80 text-white shadow-md shadow-success-300/40 after:absolute after:inset-[0.15em] after:bg-linear-to-b after:from-success-300/50 after:via-success-100/10 after:to-success-300/5 after:rounded-[inherit] after:h-1/2',
        warning:
          'bg-white bg-linear-to-b from-warning-600/85 via-warning-600/75 dark:from-warning-600 dark:via-warning-600/85 to-warning-400 hover:from-warning-500 hover:via-warning-500 hover:to-warning-400/80 text-white shadow-md shadow-warning-300/40 after:absolute after:inset-[0.15em] after:bg-linear-to-b after:from-warning-300/50 after:via-warning-100/10 after:to-warning-300/5 after:rounded-[inherit] after:h-1/2',
        ghost:
          'text-blue-600 hover:bg-blue-50 focus:ring-blue-500 disabled:text-blue-300',
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