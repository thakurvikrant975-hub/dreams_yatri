// RadioGroup.tsx
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
import { cn } from '@/app/lib/utils';
import { CheckIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import { RadioGroupProps } from '@/app/types/components/ui/form/RadioGroup';
import { RadioContextType } from '@/app/types/components/ui/form/RadioGroup';
import Image from 'next/image';
import { Text } from '../ui/Typography';

const RadioContext = createContext<RadioContextType | null>(null);

function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('Radio must be used inside RadioGroup');
  return ctx;
}


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
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
  };

  return (
    <div className={cn('space-y-2', wrapperClassName)}>
      {name && <input type="hidden" name={name} value={selectedValue ?? ''} />}
      <RadioContext.Provider value={{ value: selectedValue, setValue, name, disabled }}>
        <div role="radiogroup" className={cn(className)}>
          {children}
        </div>
      </RadioContext.Provider>
      {error && <p className="text-error text-xs font-medium">{error}</p>}
      {success && !error && <p className="text-success text-xs font-medium">Looks good</p>}
    </div>
  );
}

// ─── Variant: Default (standard row) ─────────────────────────────────────────

interface RadioProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Radio({ value, children, disabled, className }: RadioProps) {
  const { value: selected, setValue, disabled: groupDisabled } = useRadio();
  const isSelected = selected === value;
  const isDisabled = groupDisabled || disabled;

  return (
    <label
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ring-1 ring-inset',
        isDisabled && 'opacity-50 cursor-not-allowed',
        isSelected
          ? 'bg-primary-50 ring-primary-400 text-primary-600'
          : 'bg-surface ring-neutral-300 hover:bg-neutral-50 text-primary',
        className
      )}
    >
      <input
        type="radio"
        name={undefined}
        value={value}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => setValue(value)}
        className="sr-only"
      />
      <span className={cn(
        'size-4 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
        isSelected ? 'border-primary-500 bg-primary-500' : 'border-neutral-400 bg-transparent'
      )}>
        {isSelected && <span className="size-1.5 rounded-full bg-white" />}
      </span>
      <span className="text-sm font-medium flex-1">{children}</span>
    </label>
  );
}

// ─── Variant: Image Card (trip duration) ─────────────────────────────────────

interface RadioImageCardProps {
  value: string;
  label: string;
  image: string;
  priceLabel?: string;
  price: string;
  disabled?: boolean;
  className?: string;
}

export function RadioImageCard({
  value,
  label,
  image,
  priceLabel = 'Starting From',
  price,
  disabled,
  className,
}: RadioImageCardProps) {
  const { value: selected, setValue, disabled: groupDisabled } = useRadio();
  const isSelected = selected === value;
  const isDisabled = groupDisabled || disabled;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && setValue(value)}
      disabled={isDisabled}
      className={cn(
        'flex flex-col w-24 shrink-0 rounded-[14px]  transition-all duration-150 ',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Image */}
      <div className="relative w-full">
        <Image
          src={image}
          alt={label}
          width={500}
          height={500}
          className={cn("w-full aspect-square object-cover rounded-[11px] ", isSelected ? 'ring-[0.12em] ring-offset-3 ring-primary-500' : '' )}
        />
        <span className="absolute bottom-1.5 left-2 text-[13px] font-semibold text-white drop-shadow-sm">
          {label}
        </span>
      </div>
      {/* Price */}
      <div className="py-1.5 ">
        <Text size='xs' intent='secondary'>{priceLabel}</Text>
        <Text size='sm' intent='primary' weight='bold'>{price}</Text>
      </div>
    </button>
  );
}

// ─── Variant: Route Row (destination routes) ──────────────────────────────────

interface RadioRouteProps {
  value: string;
  stops: string[];
  disabled?: boolean;
  className?: string;
}

export function RadioRoute({ value, stops, disabled, className }: RadioRouteProps) {
  const { value: selected, setValue, disabled: groupDisabled } = useRadio();
  const isSelected = selected === value;
  const isDisabled = groupDisabled || disabled;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && setValue(value)}
      disabled={isDisabled}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-150 cursor-pointer shadow-md shadow-neutral-200/85',
        isSelected
          ? 'border-primary-300 bg-primary-50'
          : 'border-(--border-muted) bg-surface hover:bg-neutral-50',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Stops with arrows */}
      <div className="flex items-center gap-2">
        {stops.map((stop, i) => (
          <span key={stop} className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-semibold',
              isSelected ? 'text-brand' : 'text-primary'
            )}>
              {stop}
            </span>
            {i < stops.length - 1 && (
              <ArrowRightIcon className={cn(
                'size-3.5 shrink-0',
                isSelected ? 'text-brand' : 'text-muted'
              )} />
            )}
          </span>
        ))}
      </div>

      {/* Check indicator */}
      {isSelected && (
        <span className="size-5 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
          <CheckIcon className="size-3 text-white" />
        </span>
      )}
    </button>
  );
}

// ─── Variant: Pill (stay category) ───────────────────────────────────────────

interface RadioPillProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function RadioPill({ value, children, disabled, className }: RadioPillProps) {
  const { value: selected, setValue, disabled: groupDisabled } = useRadio();
  const isSelected = selected === value;
  const isDisabled = groupDisabled || disabled;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && setValue(value)}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border-[0.1em] text-sm font-medium transition-all duration-150 shadow-md shadow-neutral-200/80',
        isSelected
          ? 'border-primary-400 text-brand bg-primary-50'
          : 'border-neutral-300 text-primary bg-surface hover:border-neutral-400',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
      {isSelected && (
        <span className="size-4.5 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
          <CheckIcon className="size-2.5 text-white" />
        </span>
      )}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function RadioSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'min-h-18 rounded-xl bg-surface-muted animate-pulse',
      className
    )} />
  );
}