'use client';

import { cn } from '@/app/services/cn';
import { CheckIcon } from '@heroicons/react/24/solid';
import React, { forwardRef } from 'react';

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hasError?: boolean;
  success?: boolean;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
  innerWrapperClassName?: string;
  message?: string;
  loading?: {
    isLoading: boolean;
    message?: string;
  };
}

const Textarea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (props, ref) => {
    const {
      className = '',
      success = false,
      error,
      rightIcon,
      wrapperClassName = '',
      innerWrapperClassName = '',
      message,
      disabled = false,
      loading,
      ...textareaProps
    } = props;

    const loadingState = loading ?? { isLoading: false };
    const loadingMessage = loadingState.message ?? 'Loading...';

    let inputClasses =
      'w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500/80 ' +
      'dark:placeholder:text-zinc-500 ring-[0.09em] ring-inset outline-none ' +
      'border-none focus:ring-2 font-medium min-h-16';

    if (disabled) {
      inputClasses +=
        ' text-gray-500 dark:text-zinc-500/80 ring-gray-300 bg-gray-100 ' +
        'dark:bg-zinc-800/60 dark:ring-zinc-700/60 cursor-not-allowed';
    } else if (error) {
      inputClasses +=
        'text-error-800 dark:text-error-100 ring-error-300 focus:ring-error-400 bg-error-500/15';
    } else if (success) {
      inputClasses +=
        'ring-gray-400/60 dark:ring-zinc-600/90 focus:ring-success-400';
    } else {
      inputClasses +=
        ' text-gray-900 dark:text-white focus:ring-blue-400 ' +
        'dark:focus:ring-blue-400 bg-white dark:bg-zinc-800 ' +
        'hover:ring-gray-400 ring-gray-400/60 dark:ring-zinc-600/90 dark:hover:ring-zinc-500';
    }

    return (
      <div className={cn(wrapperClassName)}>
        <div className={cn('relative', innerWrapperClassName)}>
          <textarea
            ref={ref}
            disabled={disabled}
            className={cn(inputClasses, className)}
            {...textareaProps}
          />
          {rightIcon && !success && (
          <span className="absolute top-5 right-4 z-30 -translate-y-1/2 cursor-pointer">
            {rightIcon}
          </span>
        )}
        {success && (
          <div className="absolute top-5 right-4 z-30 -translate-y-1/2">
            <span className='flex items-center justify-center size-5 rounded-full bg-success-600'>
              <CheckIcon className='size-3 text-white stroke-3' />
            </span>
          </div>
        )}
        </div>

        {error && (
          <p className="text-error-500 mt-1.5 text-xs font-medium">
            {error}
          </p>
        )}

        {loadingState.isLoading && !error && (
          <p className="text-gray-500 dark:text-zinc-400 mt-1.5 text-xs font-medium flex gap-2 items-center">
            {loadingMessage}
            <span className="bg-transparent border-t-2 border-l-2 border-r-2 border-gray-500 dark:border-zinc-500 animate-spin rounded-full size-4" />
          </p>
        )}

        {!error && !loadingState.isLoading && message && (
          <p className="text-gray-500 dark:text-zinc-400 mt-1.5 text-xs font-medium">
            {message}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
