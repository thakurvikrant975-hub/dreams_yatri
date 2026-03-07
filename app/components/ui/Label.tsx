'use client'
import { cn } from '@/app/services/cn';
import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

const Label: React.FC<LabelProps> = ({ children, className, required, ...props }) => {
  return (
    <label 
      className={cn('block text-sm/7 font-medium text-gray-700 dark:text-zinc-400', className)} 
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-0.5"> *</span>}
    </label>
  );
};

export default Label;