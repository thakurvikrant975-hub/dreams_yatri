'use client'

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
} from '@headlessui/react'
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  GlobeAltIcon,
} from '@heroicons/react/20/solid'
import { Bars3Icon, BellIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Button from '../ui/Button'
import Image from 'next/image'

const user = {
  name: 'Chelsea Hagon',
  email: 'chelsea.hagon@example.com',
  imageUrl:
    'https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
}

const navigation = [
  { name: 'Dashboard', href: '#', current: true },
  { name: 'Calendar', href: '#', current: false },
  { name: 'Teams', href: '#', current: false },
  { name: 'Directory', href: '#', current: false },
]

const userNavigation = [
  { name: 'Your profile', href: '#' },
  { name: 'Settings', href: '#' },
  { name: 'Sign out', href: '#' },
]

const services = [
  { name: 'Holiday Packages', href: '#' },
  { name: 'Honeymoon Tours', href: '#' },
  { name: 'Corporate Travel', href: '#' },
  { name: 'Pilgrimage Tours', href: '#' },
]

const languages = [
  { name: 'English', code: 'En' },
  { name: 'Hindi', code: 'Hi' },
  { name: 'Tamil', code: 'Ta' },
]

export default function Header() {
  return (
    <>
      <Popover
        as="header"
        className="relative bg-white shadow-sm shadow-neutral-200/80 data-open:fixed data-open:inset-0 data-open:z-40 data-open:overflow-y-auto lg:overflow-y-visible data-open:lg:overflow-y-visible"
      >
        <div className="mx-auto max-w-container px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4 lg:gap-6">

            {/* ── Logo ── */}
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


            <div className="flex-1 md:px-8 lg:px-0 xl:col-span-6">
              <div className=" max-w-80 m-auto">
                <div className="flex items-center px-6 py-3.5 md:mx-auto md:max-w-3xl lg:mx-0 lg:max-w-none xl:px-0 ">
                  <div className="grid w-full grid-cols-1">
                    <input
                      name="search"
                      placeholder="Search"
                      className="col-start-1 row-start-1 block w-full rounded-full bg-white py-2 pr-3 pl-12 text-neutral-900 outline-1 -outline-offset-1 outline-neutral-300 placeholder-color focus:outline-2 focus:-outline-offset-2 focus:outline-primary-400 sm:text-sm/6 shadow-md shadow-gray-200/70"
                    />
                    <MagnifyingGlassIcon
                      aria-hidden="true"
                      className="pointer-events-none col-start-1 row-start-1 ml-5 size-5 self-center text-muted"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right nav (desktop) ── */}
            <div className="hidden lg:flex lg:items-center lg:gap-7">

              {/* Services dropdown */}
              <Menu as="div" className="relative">
                <MenuButton className="flex items-center gap-1  font-semibold text-neutral-900 hover:text-red-600 transition-colors">
                  Services
                  <ChevronDownIcon className="size-6 text-disabled" />
                </MenuButton>
                <MenuItems className="absolute right-0 z-20 mt-2 w-52 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-neutral-200 focus:outline-none py-1">
                  {services.map((item) => (
                    <MenuItem key={item.name}>
                      {({ focus }: { focus: boolean }) => (
                        <a
                          href={item.href}
                          className={`block px-4 py-2.5 text-sm text-neutral-700 transition-colors ${focus ? 'bg-red-50 text-red-600' : ''
                            }`}
                        >
                          {item.name}
                        </a>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>


              {/* Language selector */}
              <Menu as="div" className="relative">
                <MenuButton className="flex flex-col items-start gap-1 text-neutral-700 hover:text-red-600 transition-colors outline-none">
                  <span className="text-xs text-secondary leading-none">Language</span>
                  <span className="flex items-center gap-0.5  font-semibold leading-tight">
                    En
                    <ChevronDownIcon className="size-4.5 text-disabled" />
                  </span>
                </MenuButton>
                <MenuItems className="absolute right-0 z-20 mt-2 w-36 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-neutral-200 focus:outline-none py-1">
                  {languages.map((lang) => (
                    <MenuItem key={lang.code}>
                      {({ focus }: { focus: boolean }) => (
                        <button
                          className={`w-full text-left px-4 py-2.5 text-sm text-neutral-700 transition-colors ${focus ? 'bg-red-50 text-red-600' : ''
                            }`}
                        >
                          {lang.name}
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>

              <Button variant="premium" size="md" >
                Pay Now
              </Button>
            </div>

            {/* ── Mobile menu toggle ── */}
            <div className="flex items-center lg:hidden">
              <PopoverButton className="group relative -mx-2 inline-flex items-center justify-center rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-red-600">
                <span className="absolute -inset-0.5" />
                <span className="sr-only">Open menu</span>
                <Bars3Icon aria-hidden="true" className="block size-6 group-data-open:hidden" />
                <XMarkIcon aria-hidden="true" className="hidden size-6 group-data-open:block" />
              </PopoverButton>
            </div>
          </div>
        </div>

        {/* ── Mobile panel ── */}
        <PopoverPanel
          as="nav"
          aria-label="Global"
          className="absolute left-0 z-20 w-full bg-white shadow-lg lg:hidden"
        >
          {/* Mobile search */}
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

          {/* Mobile nav links */}
          <div className="relative mx-auto space-y-0.5 px-3 pt-1 pb-3">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${item.current
                    ? 'bg-red-50 text-red-600'
                    : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
              >
                {item.name}
              </a>
            ))}

            {/* Services in mobile */}
            <div className="pt-1 border-t border-neutral-100">
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Services
              </p>
              {services.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          {/* Mobile user section */}
          <div className="relative border-t border-neutral-200 pt-4 pb-3">
            <div className="mx-auto flex max-w-3xl items-center px-4 sm:px-6">
              <div className="shrink-0">
                <img
                  alt=""
                  src={user.imageUrl}
                  className="size-9 rounded-full bg-neutral-100 ring-1 ring-black/5"
                />
              </div>
              <div className="ml-3">
                <div className="text-sm font-semibold text-neutral-800">{user.name}</div>
                <div className="text-xs text-neutral-500">{user.email}</div>
              </div>
              <button
                type="button"
                className="relative ml-auto shrink-0 rounded-full p-1 text-neutral-400 hover:text-neutral-500 focus:outline-2 focus:outline-offset-2 focus:outline-red-600"
              >
                <span className="absolute -inset-1.5" />
                <span className="sr-only">View notifications</span>
                <BellIcon aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="mx-auto mt-3 max-w-3xl space-y-0.5 px-3 sm:px-4">
              {userNavigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block rounded-md px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  {item.name}
                </a>
              ))}
            </div>

            <div className="mt-4 px-4 sm:px-6">
              <Button variant="error" size="md">
                Pay Now
              </Button>
            </div>
          </div>
        </PopoverPanel>
      </Popover>
    </>
  )
}



