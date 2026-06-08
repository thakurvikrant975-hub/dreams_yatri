'use client'
import React, { useRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/app/lib/utils';

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
  trailing?: React.ReactNode;
  /** Optional id prefix — used to link tabs to their panels via aria-controls */
  idPrefix?: string;
}

const tabVariants = cva(
  'group inline-flex items-center border-b-2 px-1 pb-4 pt-1 text-sm font-medium transition-colors duration-200 cursor-pointer',
  {
    variants: {
      active: {
        true: 'border-primary-500 text-brand',
        false: 'border-transparent text-secondary hover:border-neutral-300 hover:text-primary',
      },
    },
    defaultVariants: { active: false },
  }
);

const tabIconVariants = cva('-ml-0.5 mr-2 size-5 transition-colors duration-200', {
  variants: {
    active: {
      true: 'text-primary-500',
      false: 'text-muted group-hover:text-secondary',
    },
  },
  defaultVariants: { active: false },
});

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, trailing, idPrefix = 'tab' }) => {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, currentIdx: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (currentIdx + 1) % tabs.length;
    if (e.key === 'ArrowLeft')  next = (currentIdx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home')       next = 0;
    if (e.key === 'End')        next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    const newTab = tabs[next];
    onTabChange(newTab.id);
    // Move focus to the newly-selected tab button
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    btns?.[next]?.focus();
  };

  return (
    <>
      {/* Mobile — scrollable pill tabs */}
      <div className="sm:hidden overflow-x-auto scrollbar-none border-b border-neutral-200">
        <div
          ref={listRef}
          role="tablist"
          aria-label="Navigation tabs"
          className="flex items-center gap-1 pb-0"
        >
          {tabs.map((tab, i) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`${idPrefix}-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`${idPrefix}-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className={cn(
                  'shrink-0 px-4 py-3 text-sm border-b-2 transition-colors duration-200',
                  isActive
                    ? 'border-primary-500 text-brand font-semibold'
                    : 'border-transparent text-secondary font-medium hover:text-primary'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop — tab bar */}
      <div className="hidden sm:block">
        <div className="border-b border-neutral-200">
          <div
            ref={listRef}
            role="tablist"
            aria-label="Navigation tabs"
            className="-mb-px flex items-center gap-6"
          >
            {tabs.map((tab, i) => {
              const isActive = tab.id === activeTab;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`${idPrefix}-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${idPrefix}-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onTabChange(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  className={tabVariants({ active: isActive })}
                >
                  {Icon && (
                    <Icon aria-hidden="true" className={tabIconVariants({ active: isActive })} />
                  )}
                  <div
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-full transition-all',
                      isActive ? 'text-primary-500' : 'text-neutral-500'
                    )}
                  >
                    <span className="text-sm font-medium">{tab.label}</span>
                    {tab.caption && (
                      <span
                        className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          isActive ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-500'
                        )}
                      >
                        {tab.caption}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {trailing && (
              <div className="ml-auto flex items-center pb-3">
                {trailing}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Tabs;
