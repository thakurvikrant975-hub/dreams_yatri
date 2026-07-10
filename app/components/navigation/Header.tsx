'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { UserIcon } from '@heroicons/react/24/solid'
import Button from '../ui/Button'
import Image from 'next/image'
import DyLogo from '@/app/components/ui/DyLogo'
import Link from 'next/link'
import MobileMenu from './MobileMenu'
import MarketingTopbar from './MarketingTopbar'
import LanguageDropdown from './LanguageDropdown'
import ServiceDropdown from './ServiceDropdown'
import { SearchDropdown } from './SearchDropdown'
import { useSession } from 'next-auth/react'
import { useModal } from '@/app/hooks/useModals'
import { useRouter } from 'next/navigation'
 
interface HeaderProps {
  transparent?: boolean;
  sticky?: boolean;
}

export default function Header({ transparent = false, sticky = true }: HeaderProps) {
  const [scrolled,          setScrolled]          = useState(false)
  const [mobileSearchOpen,  setMobileSearchOpen]  = useState(false)
  const { data: session, status } = useSession()
  const openModal  = useModal(s => s.openModal)
  const router     = useRouter()

  useEffect(() => {
    if (!transparent) return
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [transparent])

  // Close mobile search on resize to md+
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileSearchOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isSolid   = !transparent || scrolled
  const isLoggedIn = status === 'authenticated' && !!session?.user

  function handleProfileClick() {
    if (isLoggedIn) router.push('/profile')
    else openModal('login-modal')
  }

  function handleRegisterClick() {
    openModal('login-modal')
  }

  return (
    <>
      <MarketingTopbar />
      <div className={`${sticky ? 'sticky top-0' : 'relative'} left-0 z-(--z-sticky)`}>
        <motion.header
          animate={{
            backgroundColor: isSolid ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)',
            boxShadow: isSolid
              ? '0 1px 3px 0 rgba(163,163,163,0.2)'
              : '0 0 0 0 rgba(0,0,0,0)',
          }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="relative h-header-height overflow-visible"
        >
          <div className="screen-space h-full">
            <div className="flex items-center justify-between gap-3 lg:gap-6 h-full">

              {/* Logo */}
              <div className="flex shrink-0 items-center">
                <Link href="/" aria-label="Dreams Yatri home">
                  <DyLogo className={`w-36 sm:w-46 ${isSolid ? 'text-primary-500' : 'text-white'}`} />
                </Link>
              </div>

              {/* Desktop search — md and up */}
              <div className="hidden md:block md:flex-1 md:max-w-sm lg:max-w-md xl:max-w-lg">
                <SearchDropdown isSolid={isSolid} />
              </div>

              {/* Right nav — desktop */}
              <div className="hidden lg:flex lg:items-center lg:gap-8">
                <ServiceDropdown isSolid={isSolid} />
                <LanguageDropdown isSolid={isSolid} />

                {isLoggedIn && (
                  <motion.button
                    onClick={handleProfileClick}
                    animate={{ color: isSolid ? '#6A7282' : '#ffffff' }}
                    transition={{ duration: 0.3 }}
                    className={`size-9 rounded-full flex justify-center items-center ring-1 cursor-pointer transition-all overflow-hidden ${
                      isSolid
                        ? 'bg-neutral-100 text-neutral-900 shadow-md shadow-gray-300/60 ring-(--border-muted) hover:bg-neutral-200'
                        : 'bg-white/15 text-white backdrop-blur-sm shadow-none ring-white/40 hover:bg-white/25'
                    }`}
                    title="Go to profile"
                  >
                    {session.user.image ? (
                      <Image
                        src={session.user.image}
                        alt={session.user.name ?? 'Profile'}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="size-4.5" />
                    )}
                  </motion.button>
                )}

                {!isLoggedIn && (
                  <Button variant="premium" size="md" onClick={handleRegisterClick}>
                    Register
                  </Button>
                )}
              </div>

              {/* Mobile right: search icon + spacer for hamburger */}
              <div className="lg:hidden flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(v => !v)}
                  aria-label="Toggle search"
                  className={`size-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                    mobileSearchOpen
                      ? 'bg-primary-50 text-primary-600'
                      : isSolid
                        ? 'text-neutral-500 hover:bg-neutral-100'
                        : 'text-white/80 hover:bg-white/15'
                  }`}
                >
                  <MagnifyingGlassIcon className="size-5" />
                </button>
                {/* spacer for MobileMenu hamburger */}
                <div className="w-11 shrink-0" />
              </div>

            </div>
          </div>

          {/* MobileMenu */}
          <div className="lg:hidden">
            <MobileMenu isSolid={isSolid} />
          </div>
        </motion.header>

        {/* Mobile search bar — slides in below header */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              key="mobile-search"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden bg-white border-b border-neutral-200 shadow-md shadow-neutral-100/80"
            >
              <div className="px-4 py-3">
                <SearchDropdown
                  isSolid
                  autoFocus
                  onClose={() => setMobileSearchOpen(false)}
                  className="w-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
