'use client';

import {
    createContext,
    useContext,
    useState,
    ReactNode,
} from 'react';

import { cn } from '@/app/services/cn';
import { RadioCircle } from './RadioCircle';

interface RadioContextType {
    value: string | undefined;
    setValue: (value: string) => void;
    name?: string;
    disabled?: boolean;
}

const RadioContext = createContext<RadioContextType | null>(null);

interface RadioGroupProps {
    children: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    name?: string;
    disabled?: boolean;
    error?: string;
    success?: boolean;
    className?: string;
    wrapperClassName?: string;
}

interface RadioProps {
    value: string;
    children: ReactNode;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

/* ---------------- GROUP ---------------- */

export function RadioGroup({
    children,
    value,
    defaultValue,
    onChange,
    name,
    disabled = false,
    error,
    success,
    className,
    wrapperClassName,
}: RadioGroupProps) {

    const [internalValue, setInternalValue] = useState(defaultValue);

    const isControlled = value !== undefined;
    const selectedValue = isControlled ? value : internalValue;

    const setValue = (val: string) => {
        if (disabled) return;

        if (!isControlled) {
            setInternalValue(val);
        }

        onChange?.(val);
    };

    return (
        <div className={cn('space-y-2', wrapperClassName)}>

            {/* FORM SUPPORT */}
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={selectedValue ?? ''}
                />
            )}

            <RadioContext.Provider
                value={{
                    value: selectedValue,
                    setValue,
                    name,
                    disabled,
                }}
            >
                <div
                    role="radiogroup"
                    className={cn('flex flex-col gap-2', className)}
                >
                    {children}
                </div>
            </RadioContext.Provider>

            {error && (
                <p className="text-red-500 text-xs font-medium">
                    {error}
                </p>
            )}

            {success && !error && (
                <p className="text-green-600 text-xs font-medium">
                    Looks good
                </p>
            )}

        </div>
    );
}

/* ---------------- RADIO ITEM ---------------- */

export function Radio({
    value,
    children,
    disabled,
    className,
    size = 'md',
}: RadioProps) {

    const ctx = useContext(RadioContext);

    if (!ctx) return null;

    const isSelected = ctx.value === value;
    const isDisabled = ctx.disabled || disabled;

    return (
        <label
            className={cn(
                'flex items-center gap-5 px-3 py-2 rounded-xl cursor-pointer transition ring-1 ring-inset',
                isDisabled && 'opacity-50 cursor-not-allowed',
                isSelected
                    ? 'bg-blue-500 text-white ring-blue-500'
                    : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 ring-gray-300 dark:ring-zinc-600',
                className
            )}
        >
            <RadioCircle
                name={ctx.name}
                value={value}
                checked={isSelected}
                disabled={isDisabled}
                size={size}
                onChange={() => ctx.setValue(value)}
            />

            <div className="text-sm font-medium flex-1">
                {children}
            </div>
        </label>
    );
}

export function RadioSkeltion(){
    return (
        <div
            className='min-h-18 rounded-xl cursor-pointer transition bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700  animate-pulse'
        >
        </div>
    )
}