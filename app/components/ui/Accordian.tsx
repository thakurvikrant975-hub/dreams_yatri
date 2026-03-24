// Accordion.tsx
'use client';

import {
  useState,
  useRef,
  useEffect,
  useContext,
  createContext,
  useCallback,
  type ReactNode,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AccordionCtx {
  openIds: Set<string>;
  toggle: (id: string) => void;
  variant: 'default' | 'bordered' | 'ghost';
}

interface ItemCtx {
  id: string;
  isOpen: boolean;
  isDisabled: boolean;
  toggle: () => void;
}

const AccordionContext = createContext<AccordionCtx | null>(null);
const ItemContext = createContext<ItemCtx | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Must be used inside <Accordion>');
  return ctx;
}

function useItem() {
  const ctx = useContext(ItemContext);
  if (!ctx) throw new Error('Must be used inside <Accordion.Item>');
  return ctx;
}

export { useItem as useAccordionItem };

// ─── CVA ──────────────────────────────────────────────────────────────────────

const accordionVariants = cva('w-full', {
  variants: {
    variant: {
      default:  'flex flex-col gap-2',
      bordered: 'flex flex-col divide-y divide-neutral-200 border border-(--border-muted) rounded-2xl overflow-hidden',
      ghost:    'flex flex-col gap-1',
    },
  },
  defaultVariants: { variant: 'default' },
});

const itemVariants = cva('w-full transition-colors duration-150', {
  variants: {
    variant: {
      default:  'bg-surface border border-neutral-200 rounded-2xl overflow-hidden',
      bordered: 'bg-surface',
      ghost:    'bg-transparent',
    },
  },
  defaultVariants: { variant: 'default' },
});

const triggerVariants = cva(
  'w-full flex items-center gap-3 text-left transition-colors duration-150',
  {
    variants: {
      variant: {
        default:  'px-4 py-3.5 hover:bg-neutral-50',
        bordered: 'px-4 py-3.5 hover:bg-neutral-50',
        ghost:    'px-2 py-2.5 hover:bg-neutral-50 rounded-xl',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const contentVariants = cva('text-sm text-secondary', {
  variants: {
    variant: {
      default:  'px-4 pb-4',
      bordered: 'px-4 pb-4',
      ghost:    'px-2 pb-2.5',
    },
  },
  defaultVariants: { variant: 'default' },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccordionProps extends VariantProps<typeof accordionVariants> {
  children: ReactNode;
  multiple?: boolean;
  defaultOpen?: string[];
  className?: string;
}

interface ItemProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

interface TriggerProps {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

interface ChevronProps {
  className?: string;
}

interface ContentProps {
  children: ReactNode;
  className?: string;
}

// ─── Animated Panel — FIXED ───────────────────────────────────────────────────

function AnimatedPanel({ isOpen, children }: { isOpen: boolean; children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef   = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number | null>(null);
  // Track whether this is the very first render
  const isFirstRender = useRef(true);

  const cancelRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner   = innerRef.current;
    if (!wrapper || !inner) return;

    // On first render — set to auto immediately, no animation
    if (isFirstRender.current) {
      isFirstRender.current = false;
      wrapper.style.height   = isOpen ? 'auto' : '0px';
      wrapper.style.overflow = isOpen ? 'visible' : 'hidden';
      return;
    }

    cancelRaf();

    if (isOpen) {
      // OPENING: 0 → measured px → auto
      const targetH = inner.scrollHeight;
      wrapper.style.overflow = 'hidden';
      wrapper.style.height   = '0px';

      rafRef.current = requestAnimationFrame(() => {
        wrapper.style.height = `${targetH}px`;

        const onTransitionEnd = () => {
          // Only set auto if still open (user may have toggled again)
          if (wrapper.style.height !== '0px') {
            wrapper.style.height   = 'auto';
            wrapper.style.overflow = 'visible';
          }
          wrapper.removeEventListener('transitionend', onTransitionEnd);
        };
        wrapper.addEventListener('transitionend', onTransitionEnd);
      });
    } else {
      // CLOSING: auto → measured px → 0
      // First lock to current rendered height, then animate to 0
      wrapper.style.overflow = 'hidden';
      wrapper.style.height   = `${inner.scrollHeight}px`;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          wrapper.style.height = '0px';
        });
      });
    }

    return cancelRaf;
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      style={{ transition: 'height 240ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
}

// ─── Compound Components ──────────────────────────────────────────────────────

function Item({ id, children, disabled = false, className }: ItemProps) {
  const { openIds, toggle, variant } = useAccordion();
  const isOpen = openIds.has(id);

  return (
    <ItemContext.Provider value={{ id, isOpen, isDisabled: disabled, toggle: () => toggle(id) }}>
      <div className={cn(itemVariants({ variant }), className)}>
        {children}
      </div>
    </ItemContext.Provider>
  );
}

function Trigger({ children, className, asChild = false }: TriggerProps) {
  const { isOpen, isDisabled, toggle } = useItem();
  const { variant } = useAccordion();

  if (asChild) {
    return (
      <div
        role="button"
        aria-expanded={isOpen}
        onClick={() => !isDisabled && toggle()}
        className={cn(isDisabled && 'pointer-events-none opacity-50', className)}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-expanded={isOpen}
      onClick={toggle}
      className={cn(
        triggerVariants({ variant }),
        isDisabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
}

function Chevron({ className }: ChevronProps) {
  const { isOpen } = useItem();
  return (
    <ChevronDownIcon
      className={cn(
        'size-4 text-muted shrink-0 transition-transform duration-200',
        isOpen && 'rotate-180',
        className
      )}
    />
  );
}

function Content({ children, className }: ContentProps) {
  const { isOpen } = useItem();
  const { variant } = useAccordion();

  return (
    <AnimatedPanel isOpen={isOpen}>
      <div className={cn(contentVariants({ variant }), className)}>
        {children}
      </div>
    </AnimatedPanel>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function Accordion({
  children,
  multiple = false,
  defaultOpen = [],
  variant = 'default',
  className,
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = useCallback((id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!multiple) next.clear();
        next.add(id);
      }
      return next;
    });
  }, [multiple]);

  return (
    <AccordionContext.Provider value={{ openIds, toggle, variant: variant ?? 'default' }}>
      <div className={cn(accordionVariants({ variant }), className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

Accordion.Item    = Item;
Accordion.Trigger = Trigger;
Accordion.Chevron = Chevron;
Accordion.Content = Content;

export { Accordion };
export default Accordion;