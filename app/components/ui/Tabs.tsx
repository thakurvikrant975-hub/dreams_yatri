'use client'
import React from 'react';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  caption?: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

// ─── CVA ─────────────────────────────────────────────────────────────────────

const tabVariants = cva(
  'group inline-flex items-center border-b-2 px-1 pb-4 pt-1 text-sm font-medium transition-colors duration-200 cursor-pointer',
  {
    variants: {
      active: {
        true: 'border-primary-500 text-brand',
        false: 'border-transparent text-secondary hover:border-neutral-300 hover:text-primary',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

const tabIconVariants = cva('-ml-0.5 mr-2 size-5 transition-colors duration-200', {
  variants: {
    active: {
      true: 'text-primary-500',
      false: 'text-muted group-hover:text-secondary',
    },
  },
  defaultVariants: {
    active: false,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <>

      {/* Mobile — select dropdown */}
      <div className="grid grid-cols-1 sm:hidden">
        <select
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          aria-label="Select a tab"
          className="col-start-1 row-start-1 w-full appearance-none rounded-xl bg-surface py-2 pr-8 pl-3 text-sm font-medium text-primary ring-[0.09em] ring-inset ring-neutral-300 outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-4 self-center justify-self-end text-muted"
        />
      </div>

      {/* Desktop — tab bar */}
      <div className="hidden sm:block">
        <div className="border-b border-neutral-200">
          <nav aria-label="Tabs" className="-mb-px flex gap-6">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={tabVariants({ active: isActive })}
                >
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className={tabIconVariants({ active: isActive })}
                    />
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-neutral-500 hover:bg-neutral-100"
                    )}
                  >
                    <span className="text-sm font-medium">
                      {tab.label}
                    </span>

                    {tab.caption && (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          isActive
                            ? "bg-primary text-white"
                            : "bg-neutral-100 text-neutral-500"
                        )}
                      >
                        {tab.caption}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

    </>
  );
};

export default Tabs;