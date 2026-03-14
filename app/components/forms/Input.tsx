'use client'
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';
import React, { forwardRef } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';

// ─── CVA Variants ────────────────────────────────────────────────────────────

const inputVariants = cva(
  // Base
  'w-full h-11 rounded-xl px-3 py-2 text-sm font-medium outline-none border-none ring-[0.09em] ring-inset transition duration-200 placeholder:text-(--text-muted)',
  {
    variants: {
      state: {
        default:
          'text-primary bg-surface ring-(--border-default) hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400',
        error:
          'text-error-800 ring-error-300 focus:ring-2 focus:ring-error-400 bg-error-500/15',
        success:
          'text-primary bg-surface ring-neutral-400/60 focus:ring-2 focus:ring-success-400',
        disabled:
          'text-disabled bg-surface-muted ring-neutral-300 cursor-not-allowed placeholder:text-disabled',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type InputState = 'default' | 'error' | 'success' | 'disabled';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'disabled'> {
  error?: string;
  success?: boolean;
  disabled?: boolean;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
  innerWrapperClassName?: string;
  message?: string;
  loading?: {
    isLoading: boolean;
    message?: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    className,
    success = false,
    error,
    rightIcon,
    wrapperClassName,
    innerWrapperClassName,
    message,
    disabled = false,
    loading,
    ...inputProps
  } = props;

  const loadingState = loading ?? { isLoading: false };
  const loadingMessage = loadingState.message ?? 'Loading...';

  // Derive state for CVA — priority: disabled > error > success > default
  const state: InputState = disabled
    ? 'disabled'
    : error
    ? 'error'
    : success
    ? 'success'
    : 'default';

  return (
    <div className={cn(wrapperClassName)}>
      <div className={cn('relative', innerWrapperClassName)}>
        <input
          ref={ref}
          disabled={disabled}
          className={cn(inputVariants({ state }), className)}
          {...inputProps}
        />

        {/* Right icon — hidden when success is showing */}
        {rightIcon && !success && (
          <span className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer">
            {rightIcon}
          </span>
        )}

        {/* Success indicator */}
        {success && (
          <div className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
            <span className="flex items-center justify-center size-5 rounded-full bg-success-600">
              <CheckIcon className="size-3 text-white stroke-3" />
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-error mt-1.5 text-xs font-medium">{error}</p>
      )}

      {/* Loading state */}
      {loadingState.isLoading && !error && (
        <p className="text-muted mt-1.5 text-xs font-medium flex gap-2 items-center">
          {loadingMessage}
          <span className="bg-transparent border-t-2 border-l-2 border-r-2 border-neutral-500 animate-spin rounded-full size-4" />
        </p>
      )}

      {/* Helper message */}
      {!error && !loadingState.isLoading && message && (
        <p className="text-muted mt-1.5 text-xs font-medium">{message}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export { Input, inputVariants };
export default Input;