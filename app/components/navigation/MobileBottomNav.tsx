'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  HomeIcon, GlobeAltIcon, BuildingOffice2Icon, UserIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeSolid, GlobeAltIcon as GlobeSolid,
  BuildingOffice2Icon as BuildingSolid, UserIcon as UserSolid,
} from '@heroicons/react/24/solid'
import { useModal } from '@/app/hooks/useModals'

/**
 * Bottom tab bar for phones and tablets.
 *
 * The header's Register button is `hidden lg:flex` and the hamburger menu has
 * no account entry, so below lg there was no way into the login modal at all
 * unless a booking flow forced it open. This is the standing entry point.
 *
 * Routes that already own the bottom edge with their own mobile CTA bar (the
 * package/hotel detail pages, custom packages, offers) and the checkout flow
 * opt out below — a second bar stacked under "Book now" helps nobody, and a
 * checkout shouldn't offer four ways to leave.
 */
const HIDDEN_PREFIXES = [
  '/book/',            // quote checkout
  '/bookings/',        // confirmation, payment, status
  '/custom-package/',  // has CustomMobileFooterBar
  '/offers/',          // has its own sm:hidden bottom bar
  '/hotels/',          // detail + book; the /hotels list itself still shows it
  '/packages/',        // stay detail; the /packages list itself still shows it
]

type Tab = {
  key: string
  label: string
  href: string
  icon: React.ElementType
  activeIcon: React.ElementType
  active: boolean
}

export default function MobileBottomNav() {
  const pathname = usePathname() ?? '/'
  const { data: session, status } = useSession()
  const openModal = useModal(s => s.openModal)

  if (HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix))) return null

  const isLoggedIn = status === 'authenticated' && !!session?.user
  const onProfile = pathname.startsWith('/profile')

  const tabs: Tab[] = [
    { key: 'home', label: 'Home', href: '/', icon: HomeIcon, activeIcon: HomeSolid, active: pathname === '/' },
    { key: 'holidays', label: 'Holidays', href: '/packages', icon: GlobeAltIcon, activeIcon: GlobeSolid, active: pathname.startsWith('/packages') },
    { key: 'hotels', label: 'Hotels', href: '/hotels', icon: BuildingOffice2Icon, activeIcon: BuildingSolid, active: pathname.startsWith('/hotels') },
  ]

  // First name only — "Priyanka Deshmukh" doesn't fit a quarter of a phone.
  const firstName = session?.user?.name?.trim().split(/\s+/)[0]

  const itemClass = (active: boolean) =>
    `relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
      active ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
    }`

  return (
    <>
      {/* Keeps the last of the page clear of the fixed bar. Rendered only when
          the bar is, so opted-out routes get no stray gap. */}
      <div aria-hidden className="lg:hidden h-[var(--bottom-nav-height)]" />

      <nav
        aria-label="Primary"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white
                   pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      >
        <ul className="grid grid-cols-4">
          {tabs.map(tab => {
            const Icon = tab.active ? tab.activeIcon : tab.icon
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={tab.active ? 'page' : undefined}
                  className={itemClass(tab.active)}
                >
                  {tab.active && (
                    <span aria-hidden className="absolute top-0 h-0.5 w-10 rounded-b-full bg-primary-600" />
                  )}
                  <Icon className="size-5.5" />
                  {tab.label}
                </Link>
              </li>
            )
          })}

          <li>
            {isLoggedIn ? (
              <Link
                href="/profile"
                aria-current={onProfile ? 'page' : undefined}
                className={itemClass(onProfile)}
              >
                {onProfile && (
                  <span aria-hidden className="absolute top-0 h-0.5 w-10 rounded-b-full bg-primary-600" />
                )}
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt=""
                    width={22}
                    height={22}
                    className={`size-5.5 rounded-full object-cover ring-1 ${
                      onProfile ? 'ring-primary-600' : 'ring-neutral-300'
                    }`}
                  />
                ) : onProfile ? (
                  <UserSolid className="size-5.5" />
                ) : (
                  <UserIcon className="size-5.5" />
                )}
                <span className="max-w-full truncate px-1">{firstName || 'Profile'}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openModal('login-modal')}
                className={`w-full cursor-pointer ${itemClass(false)}`}
              >
                <UserIcon className="size-5.5" />
                {/* One passwordless flow covers both, so one label does too. */}
                Log in
              </button>
            )}
          </li>
        </ul>
      </nav>
    </>
  )
}
