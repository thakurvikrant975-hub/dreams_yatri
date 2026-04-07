'use client'
import { cn } from '@/app/lib/utils';
import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

const Label: React.FC<LabelProps> = ({ children, className, required, ...props }) => {
  return (
    <label
      className={cn('block text-sm/6 font-medium text-secondary', className)}
      {...props}
    >
      {children}
      {required && <span className="text-error ml-0.5"> *</span>}
    </label>
  );
};

export default Label;