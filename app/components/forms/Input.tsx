'use client'
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';
import React, { forwardRef } from 'react';
import { CheckIcon } from '@heroicons/react/24/solid';

// ─── CVA Variants ────────────────────────────────────────────────────────────


const inputVariants = cva(
  'w-full rounded-xl font-medium outline-none border-none ring-[0.09em] ring-inset placeholder:text-neutral-400/60 placeholder:font-normal outline-none',
  {
    variants: {
      state: {
        default:
          'text-primary bg-surface ring-neutral-400/80 hover:ring-neutral-300 focus:ring-2 focus:ring-primary-400',
        error:
          'text-error-800 ring-error-300 focus:ring-2 focus:ring-error-400 bg-error-500/15',
        success:
          'text-primary bg-surface ring-neutral-400/60 focus:ring-2 focus:ring-success-400',
        disabled:
          'text-disabled bg-surface-muted ring-neutral-300 cursor-not-allowed placeholder:text-disabled',
      },
      size: {
        sm: 'h-9  px-2.5 py-1.5 text-xs',
        md: 'h-11 px-3  py-2   text-sm',
        lg: 'h-13 px-4  py-2.5 text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'md',
    },
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type InputState = 'default' | 'error' | 'success' | 'disabled';
type InputSize = 'sm' | 'md' | 'lg';

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'disabled' | 'size'> {
  size?: InputSize;
  error?: string;
  success?: boolean;
  disabled?: boolean;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
  innerWrapperClassName?: string;
  message?: string;
  /** Stable id used to link aria-describedby — defaults to a random id if not supplied */
  inputId?: string;
  loading?: {
    isLoading: boolean;
    message?: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────


const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    className,
    size = 'md',
    success = false,
    error,
    rightIcon,
    wrapperClassName,
    innerWrapperClassName,
    message,
    inputId,
    disabled = false,
    loading,
    id: idProp,
    ...inputProps
  } = props;

  // Stable id for aria-describedby wiring (use caller-supplied id or inputId)
  const baseId = idProp ?? inputId ?? (typeof React.useId === 'function' ? React.useId() : undefined);
  const errorId   = baseId ? `${baseId}-error`   : undefined;
  const messageId = baseId ? `${baseId}-message`  : undefined;
  const describedBy = error ? errorId : message ? messageId : undefined;

  const loadingState = loading ?? { isLoading: false };
  const loadingMessage = loadingState.message ?? 'Loading...';

  const state: InputState = disabled
    ? 'disabled'
    : error
      ? 'error'
      : success
        ? 'success'
        : 'default';

  // Icon size scales with input size
  const iconSizeClass: Record<InputSize, string> = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
  };

  return (
    <div className={cn(wrapperClassName)}>
      <div className={cn('relative', innerWrapperClassName)}>
        <input
          ref={ref}
          id={baseId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(inputVariants({ state, size }), className)}
          {...inputProps}
        />

        {rightIcon && !success && (
          <span aria-hidden="true" className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer">
            {rightIcon}
          </span>
        )}

        {success && (
          <div className="absolute top-1/2 right-4 z-30 -translate-y-1/2">
            <span className={cn('flex items-center justify-center rounded-full bg-success-600', iconSizeClass[size])}>
              <CheckIcon className="size-3 text-white stroke-3" />
            </span>
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" aria-live="polite" className="text-error mt-1.5 text-xs font-medium">{error}</p>
      )}

      {loadingState.isLoading && !error && (
        <p className="text-muted mt-1.5 text-xs font-medium flex gap-2 items-center" aria-live="polite">
          {loadingMessage}
          <span aria-hidden="true" className="bg-transparent border-t-2 border-l-2 border-r-2 border-neutral-500 animate-spin rounded-full size-4" />
        </p>
      )}

      {!error && !loadingState.isLoading && message && (
        <p id={messageId} className="text-muted mt-1.5 text-xs font-medium">{message}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export { Input, inputVariants };
export type { InputSize, InputProps };
export default Input;

