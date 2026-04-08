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
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 min-w-20">
      <span className="text-white/80">{icon}</span>
      <span className="text-lg font-bold text-white leading-none">{value}</span>
      <span className="text-[11px] text-white/60 font-medium whitespace-nowrap">{label}</span>
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
    <div className={cn('bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden', className)}>
      <div className="px-6 py-4 border-b border-neutral-100 bg-linear-to-r from-primary-50/60 to-transparent">
        <Heading level={3} size="base" weight="semibold" className="text-primary">
          {title}
        </Heading>
        {subtitle && <p className="text-xs text-[--text-muted] mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
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
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="group">
      <Label htmlFor={label}>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        {editing ? (
          <>
            <Input
              id={label}
              type={type}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              size="md"
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <div
              className={cn(
                'flex-1 h-11 px-3 flex items-center rounded-xl text-sm font-medium',
                'bg-surface-muted ring-[0.09em] ring-inset ring-neutral-200',
                'text-primary'
              )}
            >
              {val || <span className="text-[--text-muted]">{placeholder}</span>}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-lg text-[--text-muted] hover:text-primary hover:bg-primary-50 transition-colors"
              aria-label={`Edit ${label}`}
            >
              {saved ? (
                <CheckIcon className="size-4 text-success-600" />
              ) : (
                <PencilSquareIcon className="size-4" />
              )}
            </button>
          </>
        )}
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

      <Section title="Travel Preferences" subtitle="Help us personalise your experience">
        <TravelPreferencesPanel />
      </Section>
    </div>
  )
}

// ─── Travel Preferences Panel ─────────────────────────────────────────────────

function TravelPreferencesPanel() {
  const [tripTypes, setTripTypes] = useState(['Adventure', 'Pilgrimage'])
  const [budgets, setBudgets] = useState(['Budget'])

  const allTripTypes = ['Adventure', 'Leisure', 'Pilgrimage', 'Honeymoon', 'Family', 'Corporate', 'Backpacking']
  const allBudgets   = ['Budget', 'Mid-range', 'Luxury', 'Ultra-luxury']

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wide mb-2">Trip Type</p>
        <div className="flex flex-wrap gap-2">
          {allTripTypes.map(t => (
            <TravelBadge
              key={t} label={t}
              active={tripTypes.includes(t)}
              onClick={() => toggle(tripTypes, setTripTypes, t)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wide mb-2">Budget Range</p>
        <div className="flex flex-wrap gap-2">
          {allBudgets.map(b => (
            <TravelBadge
              key={b} label={b}
              active={budgets.includes(b)}
              onClick={() => toggle(budgets, setBudgets, b)}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <Button size="sm">Save Preferences</Button>
      </div>
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
    preferences:   <PlaceholderPanel title="Travel Preferences" />,
    payments:      <PlaceholderPanel title="Payment Methods" />,
    notifications: <PlaceholderPanel title="Notification Settings" />,
  }

  return (
    <div data-layout="website" className="min-h-screen ">

      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <div className="relative bg-linear-to-br from-primary-600 via-primary-500 to-primary-700 overflow-hidden">

        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 size-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 size-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">

            <AvatarUpload />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Heading level={1} size="2xl" weight="bold" className="text-white truncate">
                  Karan Thakur
                </Heading>
                <span className="hidden sm:inline-flex items-center gap-1 bg-white/15 border border-white/25 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  <StarIcon className="size-3 text-yellow-300" />
                  Explorer
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/70 text-xs">
                <span className="flex items-center gap-1">
                  <MapPinIcon className="size-3.5" /> Shimla, Himachal Pradesh
                </span>
                <span>Member since Jan 2023</span>
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
      </div>

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
            <div className="hidden lg:block bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-linear-to-r from-primary-50/60 to-transparent">
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
                        ? 'bg-primary-50 text-primary'
                        : 'text-[--text-muted] hover:bg-neutral-50 hover:text-primary'
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
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error-600 hover:bg-error-50 transition-colors">
                  <span className="size-8 rounded-lg flex items-center justify-center bg-error-50">
                    <ArrowRightOnRectangleIcon className="size-5" />
                  </span>
                  Log Out
                </button>
              </div>
            </div>
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