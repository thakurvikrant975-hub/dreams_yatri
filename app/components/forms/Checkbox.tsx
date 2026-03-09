'use client';

import React from 'react';
import { cn } from '@/app/services/cn';

type CheckboxSize = 'sm' | 'md' | 'lg';

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: CheckboxSize;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      disabled,
      id,
      size = 'md',
      ...props
    },
    ref
  ) => {
 
    const generatedId = React.useId();
    const checkboxId = id ?? generatedId;

    const sizes = {
      sm: {
        wrapper: 'h-5',
        box: 'size-3.5 rounded-[3px]',
        icon: 'size-3',
      },
      md: {
        wrapper: 'h-6',
        box: 'size-4 rounded-sm',
        icon: 'size-3.5',
      },
      lg: {
        wrapper: 'h-7',
        box: 'size-5 rounded-md',
        icon: 'size-4',
      },
    };

    return (
      <div className={cn('flex shrink-0 items-center', sizes[size].wrapper)}>
        <div className={cn('group grid grid-cols-1', sizes[size].box)}>
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            disabled={disabled}
            className={cn(
              'col-start-1 row-start-1 appearance-none border border-white/10 bg-white/5 rounded-sm cursor-pointer',
              'checked:border-blue-500 checked:bg-blue-500',
              'indeterminate:border-blue-500 indeterminate:bg-blue-500',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
              'disabled:border-white/5 disabled:bg-white/10 disabled:checked:bg-white/10',
              'forced-colors:appearance-auto',
              className
            )}
            {...props}
          />

          <svg
            fill="none"
            viewBox="0 0 14 14"
            className={cn(
              'pointer-events-none col-start-1 row-start-1 self-center justify-self-center stroke-white',
              'group-has-disabled:stroke-white/25',
              sizes[size].icon
            )}
          >

            <path
              d="M3 8L6 11L11 3.5"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-checked:opacity-100"
            />

            <path
              d="M3 7H11"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-indeterminate:opacity-100"
            />
          </svg>
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
