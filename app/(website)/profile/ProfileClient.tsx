//app/(website)/profile/ProfileClient.tsx

'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/app/lib/utils'

import { Heading } from '@/app/components/ui/Typography'
import { signOut } from "next-auth/react"
import {
  UserCircleIcon,
  HeartIcon,
  CreditCardIcon,
  ArrowRightOnRectangleIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

import {
  MapPinIcon,
  StarIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/solid'

import { SuitcaseRollingIcon } from '@phosphor-icons/react'

import Card from '@/app/components/ui/Card'
import { PersonalInfoPanel } from './components/PersonalInfoPanel'
import { SecurityPanel } from './components/SecurityPanel'
import { TravelPreferencesPanel } from './components/TravelPreferencesPanel'
import { TravelHistoryPanel } from './components/TravelHistoryPanel'
import { PlaceholderPanel } from './components/PlaceholderPanel'
import { PaymentHistoryPanel } from './components/PaymentHistoryPanel'
import { AvatarUpload } from './components/AvatarUpload'
import { StatCard } from './components/StatCard'

type NavKey = 'personal' | 'security' | 'preferences' | 'payments' | 'notifications' | 'travel-history'

interface NavItem {
  key: NavKey
  label: string
  icon: React.ReactNode
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { key: 'personal',       label: 'Personal Info',      icon: <UserCircleIcon className="size-5" /> },
  { key: 'preferences',    label: 'Travel Preferences', icon: <HeartIcon className="size-5" /> },
  { key: 'travel-history', label: 'Travel History',     icon: <SuitcaseRollingIcon className="size-5" /> },
  { key: 'payments',       label: 'Payments',           icon: <CreditCardIcon className="size-5" /> },
]

const VALID_TABS = new Set<NavKey>(['personal', 'security', 'preferences', 'payments', 'notifications', 'travel-history']);

export default function Profile({ user, initialTab }: { user: any; initialTab?: string }) {

  const router = useRouter();

  const [activeNav, setActiveNav] = useState<NavKey>(
    NAV_ITEMS.some(item => item.key === initialTab) ? (initialTab as NavKey) : 'personal'
  );

  const handleNavChange = (key: NavKey) => {
    setActiveNav(key);
    router.replace(`/profile?tab=${key}`, { scroll: false });
  };
  console.log(user);

  const panels: Record<NavKey, React.ReactNode> = {
    personal:        <PersonalInfoPanel userBasicInfo={user} />,
    security:        <SecurityPanel />,
    preferences:     <TravelPreferencesPanel />,
    'travel-history': <TravelHistoryPanel />,
    payments:        <PaymentHistoryPanel />,
    notifications:   <PlaceholderPanel title="Notification Settings" />,
  }

  return (
    <div data-layout="website" className="min-h-screen">

      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <Card>
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 size-48 rounded-full bg-primary-500/10 blur-2xl pointer-events-none" />

        <div className="relative px-4 sm:px-6 pt-8 pb-10 sm:pt-10 sm:pb-14">
          {/* Row 1 on mobile: avatar + name side-by-side; on desktop: avatar + name left, stats right */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            {/* Avatar + name/contact */}
            <div className="flex items-end gap-4">
              <AvatarUpload name={user.name} image={user.image} />

              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <Heading level={1} size="2xl" weight="bold" className="text-neutral-900 truncate">
                    {user.name ?? 'Your Name'}
                  </Heading>
                  <span className="hidden sm:inline-flex items-center gap-1 bg-white/15 border border-white/25 text-secondary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <StarIcon className="size-3 text-yellow-300" />
                    Explorer
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-secondary text-xs">
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3.5 text-muted" /> {user.phone}
                    </span>
                  )}
                  {user.email && <span>{user.email}</span>}
                </div>
              </div>
            </div>

            {/* Stats — equal-width grid on mobile, row on desktop */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
              <StatCard icon={<GlobeAltIcon className="size-4" />}  value={user?.totalTrips   ?? 0} label="Trips"    />
              <StatCard icon={<HeartIcon className="size-4" />}     value={user?.wishlistCount ?? 0} label="Wishlist" />
              <StatCard icon={<CalendarIcon className="size-4" />}  value={user?.upcomingTrips ?? 0} label="Upcoming" />
            </div>

          </div>
        </div>
      </Card>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="mt-4 sm:mt-5 pb-12 sm:pb-16">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="w-full lg:w-64 shrink-0">

            {/* Mobile: horizontal scroll tabs */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => handleNavChange(item.key)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    activeNav === item.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-[--text-muted] border border-neutral-200 hover:border-primary/30'
                  )}
                >
                  <span className="size-4 shrink-0">{item.icon}</span>
                  {item.label}
                  {item.badge && (
                    <span className={cn(
                      'rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none',
                      activeNav === item.key ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary'
                    )}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Desktop: vertical card */}
            <Card className="hidden lg:block p-px">
              <div className="px-4 py-3 border-b border-b-(--border-default) bg-neutral-50 rounded-t-[inherit]">
                <p className="text-[11px] font-bold text-[--text-muted] uppercase tracking-wider">Account Settings</p>
              </div>
              <nav className="p-2">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.key}
                    onClick={() => handleNavChange(item.key)}
                    className={cn(
                      'w-full flex cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                      activeNav === item.key
                        ? 'bg-neutral-100 text-primary'
                        : 'text-secondary hover:bg-neutral-50 hover:text-primary hover:ring-1 hover:ring-inset hover:ring-neutral-100 hover:shadow-sm hover:shadow-neutral-200'
                    )}
                  >
                    <span className={cn(
                      'size-8 rounded-lg flex items-center justify-center shrink-0',
                      activeNav === item.key ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-500'
                    )}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="bg-error-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {/* Logout */}
              <div className="p-2 border-t border-neutral-100 mt-1">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full flex cursor-pointer items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error-600 hover:bg-error-50 hover:ring-error-100 hover:shadow-sm hover:shadow-error-200/80 transition-colors"
                >
                  <span className="size-8 rounded-lg flex items-center justify-center bg-error-50">
                    <ArrowRightOnRectangleIcon className="size-5" />
                  </span>
                  Log Out
                </button>
              </div>
            </Card>
          </aside>

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 w-full">
            {panels[activeNav]}
          </main>

        </div>
      </div>
    </div>
  )
}
