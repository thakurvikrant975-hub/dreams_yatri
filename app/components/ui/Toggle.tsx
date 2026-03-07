'use client';

import React from 'react';
import { cn } from '@/app/services/cn';

export interface ToggleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
}

const Toggle: React.FC<ToggleProps> = ({
  className,
  size = 'md',
  disabled,
  checked,
  defaultChecked,
  onChange,
  ...props
}) => {
  const sizes = {
    sm: {
      wrapper: 'w-9',
      knob: 'size-4 group-has-checked:translate-x-4',
    },
    md: {
      wrapper: 'w-11',
      knob: 'size-5 group-has-checked:translate-x-5',
    },
  };

  return (

      <div
        className={cn(
          'group relative inline-flex shrink-0 rounded-full bg-gray-200 dark:bg-zinc-700 p-0.5',
          'inset-ring inset-ring-gray-300 dark:inset-ring-zinc-600',
          'outline-offset-2 outline-blue-500',
          'transition-colors duration-200 ease-in-out',
          'has-checked:bg-blue-500 has-focus-visible:outline-2',
          sizes[size].wrapper,
          className
        )}
      >
        <span
          className={cn(
            'rounded-full bg-white shadow-xs ring-1 ring-gray-900/5',
            'transition-transform duration-200 ease-in-out',
            sizes[size].knob
          )}
        />

        <input
          type="checkbox"
          disabled={disabled}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          aria-label={'Toggle'}
          className="absolute inset-0 size-full appearance-none focus:outline-hidden cursor-pointer"
          {...props}
        />
      </div>
  );
};

export default Toggle;
