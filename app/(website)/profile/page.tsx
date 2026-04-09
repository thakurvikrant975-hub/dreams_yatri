'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/app/lib/utils'
import Button from '@/app/components/ui/Button'
import Input from '@/app/components/forms/Input'
import Label from '@/app/components/forms/Label'
import { Heading } from '@/app/components/ui/Typography'
import {
  UserCircleIcon,
  ShieldCheckIcon,
  HeartIcon,
  CreditCardIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  PencilSquareIcon,
  CheckIcon,
  CameraIcon,
} from '@heroicons/react/24/outline'
import {
  MapPinIcon,
  StarIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/solid'
import Card from '@/app/components/ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavKey = 'personal' | 'security' | 'preferences' | 'payments' | 'notifications'

interface NavItem {
  key: NavKey
  label: string
  icon: React.ReactNode
  badge?: string
}

// ─── Nav Config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { key: 'personal',      label: 'Personal Info',    icon: <UserCircleIcon className="size-5" /> },
  { key: 'security',      label: 'Login & Security', icon: <ShieldCheckIcon className="size-5" /> },
  { key: 'preferences',   label: 'Travel Preferences', icon: <HeartIcon className="size-5" /> },
  { key: 'payments',      label: 'Payments',         icon: <CreditCardIcon className="size-5" /> },
  { key: 'notifications', label: 'Notifications',    icon: <BellIcon className="size-5" />, badge: '3' },
]

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-neutral-50 backdrop-blur-sm ring-1 ring-inset ring-(--border-default) border-white/20 min-w-20">
      <span className="text-muted">{icon}</span>
      <span className="text-lg font-bold text-primary leading-none">{value}</span>
      <span className="text-[11px] text-secondary font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn(className, ' overflow-hidden p-px')}>
      <div className="px-6 py-4 bg-neutral-50 rounded-t-[inherit] border-b border-b-(--border-default)">
        <Heading level={3} size="base" weight="semibold" className="text-primary ">
          {title}
        </Heading>
        {subtitle && <p className="text-xs text-[--text-muted] mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </Card>
  )
}

// ─── Editable Field ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  type?: string
  placeholder?: string
}) {
  
  const [val, setVal] = useState(value)


  return (
    <div className="group">
      <Label htmlFor={label}>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
         <Input
              id={label}
              type={type}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              size="md"
              wrapperClassName='flex-1'
              autoFocus
            />
      </div>
    </div>
  )
}

// ─── Travel Badge ─────────────────────────────────────────────────────────────

function TravelBadge({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-[--text-muted] border-neutral-200 hover:border-primary/40 hover:text-primary'
      )}
    >
      {label}
    </button>
  )
}

// ─── Personal Info Panel ──────────────────────────────────────────────────────

function PersonalInfoPanel() {
  return (
    <div className="space-y-5">
      <Section title="Basic Details" subtitle="Your name and contact information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="First Name"    value="Karan"              placeholder="Enter first name" />
          <EditableField label="Last Name"     value="Thakur"             placeholder="Enter last name" />
          <EditableField label="Email Address" value="karan@dreamsyatri.com" type="email" />
          <EditableField label="Phone Number"  value="+91 98765 43210"    type="tel" />
          <EditableField label="Date of Birth" value="15 Aug 1995"        type="text" />
          <EditableField label="City"          value="Shimla, HP"         placeholder="Your city" />
        </div>
      </Section>

      <Section title="More Infomation" subtitle="Help us to know you more">
         <></>
      </Section>
    </div>
  )
}

// ─── Travel Preferences Panel ─────────────────────────────────────────────────

function TravelPreferencesPanel() {
  const [tripTypes, setTripTypes]   = useState<string[]>(['Adventure', 'Pilgrimage'])
  const [groupType, setGroupType]   = useState<string | null>(null)
  const [budget, setBudget]         = useState<string | null>('Budget')
  const [duration, setDuration]     = useState<string | null>(null)
  const [months, setMonths]         = useState<string[]>([])

  const allTripTypes = [
    { label: 'Adventure', icon: '⛰️' },
    { label: 'Leisure',   icon: '🌴' },
    { label: 'Pilgrimage',icon: '🧳' },
    { label: 'Honeymoon', icon: '❤️' },
    { label: 'Family',    icon: '👨‍👩‍👧' },
    { label: 'Corporate', icon: '💼' },
    { label: 'Backpacking',icon: '🏕️' },
    { label: 'Wildlife',  icon: '🐆' },
  ]

  const groupOptions = [
    { label: 'Solo',   sub: 'Just me',    icon: '👤' },
    { label: 'Couple', sub: '2 travellers', icon: '💑' },
    { label: 'Family', sub: 'With kids',  icon: '👨‍👩‍👧' },
    { label: 'Group',  sub: '6+ people',  icon: '👥' },
  ]

  const budgetOptions = [
    { label: 'Budget',       range: 'Under ₹15,000'   },
    { label: 'Mid-range',    range: '₹15K – 35K'      },
    { label: 'Luxury',       range: '₹35K – 75K'      },
    { label: 'Ultra-luxury', range: '₹75,000+'        },
  ]

  const durationOptions = [
    'Weekend (2–3N)',
    'Short (4–5N)',
    'Week (6–8N)',
    'Long (9–14N)',
    'Extended (15N+)',
  ]

  const monthOptions = [
    { label: 'Jan', peak: false },
    { label: 'Feb', peak: false },
    { label: 'Mar', peak: true  },
    { label: 'Apr', peak: true  },
    { label: 'May', peak: true  },
    { label: 'Jun', peak: false },
    { label: 'Jul', peak: false },
    { label: 'Aug', peak: false },
    { label: 'Sep', peak: true  },
    { label: 'Oct', peak: true  },
    { label: 'Nov', peak: true  },
    { label: 'Dec', peak: false },
  ]

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  return (
    <div className="space-y-5">
      <Section title="Travel Preferences" subtitle="Help use personalise your experience">
      <div className="space-y-4">

      {/* Trip Type — multi-select */}
      <div>
        <SectionLabel title="Trip Type" hint="Select all that apply" />
        <div className="flex flex-wrap gap-2">
          {allTripTypes.map(({ label, icon }) => (
            <TravelBadge
              key={label}
              label={`${icon} ${label}`}
              active={tripTypes.includes(label)}
              onClick={() => toggleMulti(tripTypes, setTripTypes, label)}
            />
          ))}
        </div>
      </div>

      {/* Travelling As — single-select */}
      <div>
        <SectionLabel title="Travelling As" />
        <div className="grid grid-cols-4 gap-2">
          {groupOptions.map(({ label, sub, icon }) => (
            <button
              key={label}
              onClick={() => setGroupType(label)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                groupType === label
                  ? 'border-[--accent] bg-[--accent-subtle] text-[--accent]'
                  : 'border-[--border] bg-[--surface] text-[--text] hover:bg-[--surface-hover]'
              )}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-semibold">{label}</span>
              <span className={cn('text-[10px]', groupType === label ? 'text-[--accent]' : 'text-[--text-muted]')}>
                {sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Budget — single-select with INR anchoring */}
      <div >
        <SectionLabel title="Budget Per Person"/>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {budgetOptions.map(({ label, range }) => (
            <button
              key={label}
              onClick={() => setBudget(label)}
              className={cn(
                'flex flex-col rounded-lg border p-3 text-left transition-colors',
                budget === label
                  ? 'border-[--accent] bg-[--accent-subtle]'
                  : 'border-[--border] bg-[--surface] hover:bg-[--surface-hover]'
              )}
            >
              <span className={cn('text-xs font-semibold', budget === label ? 'text-[--accent]' : 'text-[--text]')}>
                {label}
              </span>
              <span className={cn('text-[10px] mt-0.5', budget === label ? 'text-[--accent]' : 'text-[--text-muted]')}>
                {range}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Duration — single-select */}
      <div>
        <SectionLabel title="Trip Duration" />
        <div className="flex flex-wrap gap-2">
          {durationOptions.map(d => (
            <TravelBadge
              key={d}
              label={d}
              active={duration === d}
              onClick={() => setDuration(prev => prev === d ? null : d)}
            />
          ))}
        </div>
      </div>

      {/* Travel Month — multi-select with peak indicators */}
      <div>
        <SectionLabel
          title="Preferred Month"
          hint={<>Select all that work &nbsp;<span className="text-amber-500">●</span> peak season</>}
        />
        <div className="grid grid-cols-6 gap-1.5">
          {monthOptions.map(({ label, peak }) => (
            <button
              key={label}
              onClick={() => toggleMulti(months, setMonths, label)}
              className={cn(
                'relative flex flex-col items-center rounded-md border py-2 text-xs transition-colors',
                months.includes(label)
                  ? 'border-[--accent] bg-[--accent-subtle] font-semibold text-[--accent]'
                  : 'border-[--border] bg-[--surface] text-[--text] hover:bg-[--surface-hover]'
              )}
            >
              {label}
              {peak && (
                <span className={cn(
                  'mt-1 h-1 w-1 rounded-full',
                  months.includes(label) ? 'bg-[--accent]' : 'bg-amber-400'
                )} />
              )}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-[--text-muted]">
          Peak months reflect Himachal Pradesh &amp; Kashmir seasonality
        </p>
      </div>

      <div className="flex justify-end border-t border-[--border] pt-3">
        <Button size="sm">Save Preferences</Button>
      </div>
      </div>
      </Section>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────── */

function SectionLabel({
  title,
  hint,
}: {
  title: string
  hint?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[--text-muted]">{title}</p>
      {hint && <span className="text-[10px] text-[--text-muted]">{hint}</span>}
    </div>
  )
}

// ─── Security Panel ───────────────────────────────────────────────────────────

function SecurityPanel() {
  return (
    <div className="space-y-5">
      <Section title="Login & Security" subtitle="Manage your password and connected accounts">
        <div className="space-y-4">
          {/* Password */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <div>
              <p className="text-sm font-semibold text-primary">Password</p>
              <p className="text-xs text-[--text-muted]">Last changed 3 months ago</p>
            </div>
            <Button size="sm" variant="outline">Change Password</Button>
          </div>

          {/* Google SSO */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-neutral-100 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">Google</p>
                <p className="text-xs text-[--text-muted]">Connected · karan@gmail.com</p>
              </div>
            </div>
            <Button size="sm" variant="outline">Disconnect</Button>
          </div>

          {/* 2FA */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-primary">Two-Factor Authentication</p>
              <p className="text-xs text-[--text-muted]">Add an extra layer of protection</p>
            </div>
            <Button size="sm">Enable 2FA</Button>
          </div>
        </div>
      </Section>
    </div>
  )
}

// ─── Placeholder Panel ────────────────────────────────────────────────────────

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <Section title={title}>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <GlobeAltIcon className="size-10 text-neutral-300 mb-3" />
        <p className="text-sm font-medium text-[--text-muted]">Coming soon</p>
        <p className="text-xs text-neutral-400 mt-1">This section is under development</p>
      </div>
    </Section>
  )
}

// ─── Avatar Upload ────────────────────────────────────────────────────────────

function AvatarUpload() {
  return (
    <div className="relative group inline-block">
      <div className="size-24 sm:size-28 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg">
        <div className="size-full bg-linear-to-br from-primary-300 to-primary-600 flex items-center justify-center">
          <span className="text-3xl font-bold text-white select-none">K</span>
        </div>
      </div>
      <button
        className={cn(
          'absolute -bottom-1.5 -right-1.5 size-8 rounded-lg',
          'bg-white border border-neutral-200 shadow-md',
          'flex items-center justify-center',
          'hover:bg-primary-50 hover:border-primary/30 transition-all',
          'group-hover:scale-110'
        )}
        aria-label="Change profile photo"
      >
        <CameraIcon className="size-4 text-primary" />
      </button>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [activeNav, setActiveNav] = useState<NavKey>('personal')

  const panels: Record<NavKey, React.ReactNode> = {
    personal:      <PersonalInfoPanel />,
    security:      <SecurityPanel />,
    preferences:   <TravelPreferencesPanel/>,
    payments:      <PlaceholderPanel title="Payment Methods" />,
    notifications: <PlaceholderPanel title="Notification Settings" />,
  }

  return (
    <div data-layout="website" className="min-h-screen ">

      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <Card >

        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 size-48 rounded-full bg-primary-500/10 blur-2xl pointer-events-none" />

        <div className="relative mx-auto px-4 sm:px-6 pt-10 pb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">

            <AvatarUpload />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Heading level={1} size="2xl" weight="bold" className="text-neutral-900 truncate">
                  Karan Thakur
                </Heading>
                <span className="hidden sm:inline-flex items-center gap-1 bg-white/15 border border-white/25 text-secondary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <StarIcon className="size-3 text-yellow-300" />
                  Explorer
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary text-xs">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3.5 text-muted" /> +91 98765 43210
                </span>
                <span>example@email.com</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-2 mt-2 sm:mt-0">
              <StatCard icon={<GlobeAltIcon className="size-4" />} value="12"  label="Trips" />
              <StatCard icon={<HeartIcon className="size-4" />}    value="5"   label="Saved" />
              <StatCard icon={<StarIcon className="size-4" />}      value="4.9" label="Rating" />
            </div>

          </div>
        </div>
      </Card>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className=" mt-5 pb-16">
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <aside className="w-full lg:w-64 shrink-0">

            {/* Mobile: horizontal scroll tabs */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-semibold transition-all',
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
                    onClick={() => setActiveNav(item.key)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
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
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error-600 hover:bg-error-50 hover:ring-error-100 hover:shadow-sm hover:shadow-error-200/80 transition-colors">
                  <span className="size-8 rounded-lg flex items-center justify-center bg-error-50">
                    <ArrowRightOnRectangleIcon className="size-5" />
                  </span>
                  Log Out
                </button>
              </div>
            </Card>
          </aside>

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {panels[activeNav]}
          </main>

        </div>
      </div>
    </div>
  )
}