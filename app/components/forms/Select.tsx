'use client';

import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
} from 'react';
import { cn } from '@/app/services/cn';
import {
    useFloating,
    offset,
    flip,
    shift,
    autoUpdate,
    useClick,
    useDismiss,
    useRole,
    useInteractions,
} from '@floating-ui/react';

import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface SelectContextType {
    value: string | undefined;
    setValue: (value: string) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);


interface SelectProps {
    children: ReactNode;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    success?: boolean;
    className?: string;
    wrapperClassName?: string;
    id?: string;
    maxHeight?: 'sm' | 'md' | 'lg';
}

type labelProps = {
    value: string;
    children: React.ReactNode;
};

export function Select({
    children,
    value,
    defaultValue,
    onChange,
    name,
    placeholder = 'Select an option',
    disabled = false,
    error,
    success,
    className,
    wrapperClassName,
    id,
    maxHeight = 'lg'
}: SelectProps) {
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue);

    const isControlled = value !== undefined;
    const selectedValue = isControlled ? value : internalValue;


    const { refs, floatingStyles, context } = useFloating({
        open,
        onOpenChange: setOpen,
        placement: 'bottom-start',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'listbox' });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role,
    ]);


    const setValue = (val: string) => {
        if (!isControlled) setInternalValue(val);
        onChange?.(val);
        setOpen(false);
    };

    const selectedOption = React.Children.toArray(children).find(
        (child): child is React.ReactElement<labelProps> =>
            React.isValidElement<labelProps>(child) &&
            child.props.value === selectedValue
    );

    const selectedLabel: React.ReactNode =
        selectedOption?.props.children ?? null;

    let triggerClasses =
        'w-full h-10 rounded-xl px-3 text-sm font-medium flex items-center justify-between cursor-pointer ring-[0.09em] ring-inset transition outline-none';

    if (disabled) {
        triggerClasses +=
            ' bg-gray-100 text-gray-500 ring-gray-300 cursor-not-allowed';
    } else if (error) {
        triggerClasses +=
            ' text-error-800 dark:text-error-100 ring-error-300 focus:ring-error-400 bg-error-500/15';
    } else if (success) {
        triggerClasses +=
            ' ring-gray-400/60 dark:ring-zinc-600/90 focus:ring-success-400';
    } else {
        triggerClasses +=
            ' bg-white dark:bg-zinc-800 text-gray-900 dark:text-white hover:ring-gray-400 ring-gray-400/60 dark:ring-zinc-600/90 dark:hover:ring-zinc-500';
    }

    return (
        <div className={cn('relative', wrapperClassName)}>
            {name && (
                <input type="hidden" id={id} name={name} value={selectedValue ?? ''} />
            )}


            <div
                ref={refs.setReference}
                tabIndex={disabled ? -1 : 0}
                className={cn(triggerClasses, className)}
                {...getReferenceProps()}
            >
                <span className="truncate">
                    {selectedLabel ?? placeholder}
                </span>


                <span
                    className={cn(
                        'text-xs transition-transform duration-200',
                        open && 'rotate-180'
                    )}
                >
                    <ChevronDownIcon className='size-4.5 text-gray-500 dark:text-zinc-400' />
                </span>
            </div>

            {/* Dropdown */}
            {open && !disabled && (
                <SelectContext.Provider value={{ value: selectedValue, setValue }}>
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                        className="z-50 mt-1 w-full rounded-xl bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-black/10 overflow-hidden"
                    >
                        <div className={cn("overflow-y-auto scrollbar-mini", maxHeight === 'sm' ? 'max-h-40' : maxHeight === 'md' ? 'max-h-55' : 'max-h-70')}>
                            {children}
                        </div>
                    </div>
                </SelectContext.Provider>
            )}

            {error && (
                <p className="text-error-500 mt-1.5 text-xs font-medium">{error}</p>
            )}
        </div>
    );
}



interface OptionProps {
    value: string;
    children: ReactNode;
    disabled?: boolean;
}

export function Option({ value, children, disabled }: OptionProps) {
    const ctx = useContext(SelectContext);
    if (!ctx) return null;

    const isSelected = ctx.value === value;

    return (
        <div
            role="option"
            aria-selected={isSelected}
            onClick={() => !disabled && ctx.setValue(value)}
            className={cn(
                'px-3 py-2 text-sm cursor-pointer transition select-none',
                disabled && 'opacity-50 cursor-not-allowed',
                isSelected
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-zinc-700'
            )}
        >
            {children}
        </div>
    );
}
