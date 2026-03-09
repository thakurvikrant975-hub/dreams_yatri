'use client'

import { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Button from '../ui/Button'
import Image from 'next/image'

interface HeaderProps {
  transparent?: boolean
}

export default function Header({ transparent = false }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!transparent) return

    const threshold = 60

    const handleScroll = () => {
      setScrolled(window.scrollY > threshold)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [transparent])

  // Derived state: is header currently "solid"
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
        className="relative h-(--header-height)"
      >
        <div className="mx-auto max-w-container px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between gap-4 lg:gap-6 h-full">

            {/* Logo */}
            <div className="flex shrink-0 items-center">
              <a href="#">
                <Image
                  alt="Dreams Yatri"
                  src="/dy_logo.webp"
                  width={160}
                  height={42}
                  className="h-auto w-40"
                  priority
                />
              </a>
            </div>

            {/* Search */}
            <div className="flex-1 md:px-8 lg:px-0 xl:col-span-6">
              <div className="max-w-80 m-auto">
                <div className="flex items-center px-6 py-3.5 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0">
                  <div className="grid w-full grid-cols-1">
                    <input
                      name="search"
                      placeholder="Search"
                      className={`col-start-1 row-start-1 block w-full rounded-full py-2 pr-3 pl-12 outline-1 -outline-offset-1 placeholder-color focus:outline-2 focus:-outline-offset-2 focus:outline-primary-400 sm:text-sm/6 transition-all duration-300  ${
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

            {/* Right nav (desktop) */}
            <div className="hidden lg:flex lg:items-center lg:gap-10">
              <div className="relative">
                <motion.button
                  animate={{ color: isSolid ? '#171717' : '#ffffff' }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-1 font-semibold hover:text-red-500 transition-colors"
                >
                  Services
                  <ChevronDownIcon className="size-6 opacity-50" />
                </motion.button>
              </div>

              <div className="relative">
                <motion.button
                  animate={{ color: isSolid ? '#404040' : '#ffffff' }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-start gap-1 hover:text-red-500 transition-colors outline-none"
                >
                  <span className="text-xs leading-none opacity-60">Language</span>
                  <span className="flex items-center gap-0.5 font-semibold leading-tight">
                    En
                    <ChevronDownIcon className="size-4.5 opacity-50" />
                  </span>
                </motion.button>
              </div>

              <Button variant="premium" size="md">
                Pay Now
              </Button>
            </div>

            {/* Mobile menu toggle */}
            <div className="flex items-center lg:hidden">
              <motion.button
                animate={{ color: isSolid ? '#a3a3a3' : '#ffffff' }}
                transition={{ duration: 0.3 }}
                onClick={() => setMobileOpen(!mobileOpen)}
                className="group relative -mx-2 inline-flex items-center justify-center rounded-md p-2 hover:bg-white/10 focus:outline-2 focus:-outline-offset-1 focus:outline-red-600"
              >
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open menu</span>
                {mobileOpen
                  ? <XMarkIcon aria-hidden="true" className="size-6" />
                  : <Bars3Icon aria-hidden="true" className="size-6" />
                }
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <nav
            aria-label="Global"
            className="absolute left-0 z-20 w-full bg-white shadow-lg lg:hidden"
          >
            <div className="px-4 pt-3 pb-2">
              <div className="grid grid-cols-1">
                <input
                  name="search-mobile"
                  placeholder="Search location"
                  className="col-start-1 row-start-1 block w-full rounded-full bg-white py-2.5 pr-4 pl-11 text-neutral-900 outline-1 -outline-offset-1 outline-neutral-200 placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-2 focus:outline-red-400 text-sm shadow-sm ring-1 ring-neutral-200"
                />
                <MagnifyingGlassIcon
                  aria-hidden="true"
                  className="pointer-events-none col-start-1 row-start-1 ml-4 size-4 self-center text-neutral-400"
                />
              </div>
            </div>

            <div className="px-6 pt-3 pb-2 border-t border-neutral-100">
              <button className="flex items-center gap-1 text-sm font-semibold text-neutral-700 hover:text-red-600 transition-colors">
                Services
                <ChevronDownIcon className="size-4 text-disabled" />
              </button>
            </div>

            <div className="px-6 pb-3">
              <button className="flex items-center gap-1 text-sm font-semibold text-neutral-700 hover:text-red-600 transition-colors">
                Language (En)
                <ChevronDownIcon className="size-4 text-disabled" />
              </button>
            </div>

            <div className="px-4 pb-4 sm:px-6 border-t border-neutral-200 pt-4">
              <Button variant="error" size="md">
                Pay Now
              </Button>
            </div>
          </nav>
        )}
      </motion.header>
    </div>
  )
}