'use client';

import React from 'react';
import { cn } from '@/app/services/cn';

type RadioSize = 'sm' | 'md' | 'lg';

interface RadioCircleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: RadioSize;
}

export const RadioCircle = React.forwardRef<
  HTMLInputElement,
  RadioCircleProps
>(
  (
    {
      className,
      disabled,
      id,
      size = 'lg',
      ...props
    },
    ref
  ) => {

    const generatedId = React.useId();
    const radioId = id ?? generatedId;

    const sizes = {
      sm: {
        wrapper: 'size-3',
        outer: 'size-3.5',
        inner: 'size-1.5',
      },
      md: {
        wrapper: 'size-4',
        outer: 'size-4',
        inner: 'size-2',
      },
      lg: {
        wrapper: 'size-5',
        outer: 'size-5',
        inner: 'size-2.5',
      },
    };

    return (
      <div
        className={cn(
          'flex shrink-0 items-center bg-gray-50 dark:bg-zinc-900/20 ring-1 ring-gray-400 dark:ring-zinc-500 rounded-full has-checked:ring-blue-300 has-checked:bg-blue-500',
          sizes[size].wrapper
        )}
      >
        <div
          className={cn(
            'group grid grid-cols-1 place-items-center',
            sizes[size].outer
          )}
        >
          {/* REAL INPUT */}
          <input
            ref={ref}
            id={radioId}
            type="radio"
            disabled={disabled}
            className={cn(
              'col-start-1 row-start-1 appearance-none rounded-full cursor-pointer',
              'border border-gray-400 bg-white',
              'checked:border-blue-500 checked:bg-blue-500',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
              'disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-300',
              'forced-colors:appearance-auto',
              className
            )}
            {...props}
          />

          {/* INNER DOT */}
          <span
            className={cn(
              'pointer-events-none col-start-1 row-start-1 rounded-full dark:bg-zinc-400 scale-50 transition-transform',
              'group-has-checked:scale-100 group-has-checked:bg-white',
              sizes[size].inner
            )}
          />
        </div>
      </div>
    );
  }
);

RadioCircle.displayName = 'RadioCircle';
