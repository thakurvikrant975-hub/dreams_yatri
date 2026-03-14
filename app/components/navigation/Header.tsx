'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { UserIcon } from '@heroicons/react/24/solid'
import Button from '../ui/Button'
import Image from 'next/image'
import Link from 'next/link'
import MobileMenu from './MobileMenu'

interface HeaderProps {
  transparent?: boolean
}

export default function Header({ transparent = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!transparent) return
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [transparent])

  const isSolid = !transparent || scrolled

  return (
    <div className="sticky top-0 left-0 z-(--z-sticky)">
      <motion.header
        animate={{
          backgroundColor: isSolid ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)',
          boxShadow: isSolid
            ? '0 1px 3px 0 rgba(163,163,163,0.2)'
            : '0 0 0 0 rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        // relative — blob anchors to this; overflow-visible so blob can expand beyond header bounds
        className="relative h-header-height overflow-visible"
      >
        <div className="screen-space h-full">
          <div className="flex items-center justify-between gap-4 lg:gap-6 h-full">

            {/* Logo */}
            <div className={`flex shrink-0 items-center ${isSolid ? 'brightness-100' : 'brightness-130'}`}>
              <Link href="/">
                <Image
                  alt="Dreams Yatri"
                  src="/dy_logo.webp"
                  width={160}
                  height={42}
                  className="h-auto w-46"
                  priority
                />
              </Link>
            </div>

            {/* Search */}
            <div className="hidden md:block md:flex-1 md:px-8 lg:px-0 xl:col-span-6">
              <div className="max-w-80 m-auto">
                <div className="flex items-center px-6 py-3.5 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
                  <div className="grid w-full grid-cols-1">
                    <input
                      name="search"
                      placeholder="Search"
                      className={`col-start-1 row-start-1 block w-full rounded-full py-2 pr-3 pl-12 outline-1 -outline-offset-1 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-400 sm:text-sm/6 transition-all duration-300 ${
                        isSolid
                          ? 'bg-white text-neutral-900 outline-neutral-300 shadow-md shadow-gray-200/70'
                          : 'bg-white/15 text-white outline-white/30 placeholder:text-white/70! backdrop-blur-sm shadow-none'
                      }`}
                    />
                    <MagnifyingGlassIcon
                      aria-hidden="true"
                      className={`pointer-events-none col-start-1 row-start-1 ml-5 size-5 self-center transition-colors duration-300 z-10 ${
                        isSolid ? 'text-muted' : 'text-white/70'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right nav — desktop */}
            <div className="hidden lg:flex lg:items-center lg:gap-8">
              <motion.button
                animate={{ color: isSolid ? '#171717' : '#ffffff' }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1 font-semibold hover:text-red-500 transition-colors font-heading"
              >
                Services
                <ChevronDownIcon className="size-6 opacity-50" />
              </motion.button>

              <motion.button
                animate={{ color: isSolid ? '#404040' : '#ffffff' }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-start gap-1 hover:text-red-500 transition-colors outline-none"
              >
                <span className="text-xs leading-none opacity-60">Language</span>
                <span className="flex items-center gap-0.5 font-semibold font-heading leading-tight">
                  En
                  <ChevronDownIcon className="size-4.5 opacity-50" />
                </span>
              </motion.button>

              <motion.button
                animate={{ color: isSolid ? '#6A7282' : '#ffffff' }}
                transition={{ duration: 0.3 }}
                className={`size-9 rounded-full flex justify-center items-center ring-1 ${
                  isSolid
                    ? 'bg-neutral-100 text-neutral-900 shadow-md shadow-gray-300/60 ring-(--border-muted)'
                    : 'bg-white/15 text-white backdrop-blur-sm shadow-none ring-white/40'
                }`}
              >
                <UserIcon className="size-4.5" />
              </motion.button>

              <Button variant="premium" size="md">Register</Button>
            </div>

            {/* Mobile right spacer — matches hamburger width so logo stays centered */}
            <div className="lg:hidden w-[52px] shrink-0" />

          </div>
        </div>

        {/* MobileMenu — absolutely positioned children anchor to this header */}
        <div className="lg:hidden">
          <MobileMenu />
        </div>

      </motion.header>
    </div>
  )
}