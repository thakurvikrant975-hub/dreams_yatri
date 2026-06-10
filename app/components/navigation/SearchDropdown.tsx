'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { BuildingOffice2Icon, BookOpenIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { SuitcaseRolling } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/app/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackageResult {
  id: number
  title: string
  slug: string
  thumbnail: string | null
  destination: { name: string } | null
}
interface HotelResult {
  id: number
  name: string
  slug: string
  thumbnail: string | null
  city: string | null
  state: string | null
  category: string | null
}
interface BlogResult {
  id: string
  title: string
  slug: string
  cover_image: string | null
  excerpt: string | null
  read_time: number | null
}
interface SearchResults {
  packages: PackageResult[]
  hotels:   HotelResult[]
  blogs:    BlogResult[]
}

type TabKey = 'packages' | 'hotels' | 'blogs'

const EMPTY: SearchResults = { packages: [], hotels: [], blogs: [] }

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''

function imgSrc(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  return `${R2}/${key.replace(/^\//, '')}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isSolid?:   boolean
  autoFocus?: boolean
  onClose?:   () => void
  className?: string
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumb({ src, alt, fallback }: { src: string | null; alt: string; fallback: React.ReactNode }) {
  const url = imgSrc(src)
  return (
    <div className="size-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 flex items-center justify-center">
      {url
        ? <Image src={url} alt={alt} width={40} height={40} className="w-full h-full object-cover" unoptimized />
        : fallback
      }
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
      )}
    >
      {label}
      <span className={cn(
        'rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none',
        active ? 'bg-white/25 text-white' : 'bg-neutral-200 text-neutral-500'
      )}>
        {count}
      </span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SearchDropdown({ isSolid = true, autoFocus = false, onClose, className }: Props) {
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<SearchResults>(EMPTY)
  const [loading,    setLoading]    = useState(false)
  const [open,       setOpen]       = useState(false)
  const [activeTab,  setActiveTab]  = useState<TabKey>('packages')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Auto-select first tab that has results
  useEffect(() => {
    if (results.packages.length)    setActiveTab('packages')
    else if (results.hotels.length) setActiveTab('hotels')
    else if (results.blogs.length)  setActiveTab('blogs')
  }, [results])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); setOpen(false); return }

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)

    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: abortRef.current.signal })
      const json = await res.json()
      setResults(json.data ?? EMPTY)
      setOpen(true)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setResults(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(q), 300)
  }

  function clear() {
    setQuery(''); setResults(EMPTY); setOpen(false)
    inputRef.current?.focus()
  }

  function closeDropdown() {
    setOpen(false); setQuery(''); setResults(EMPTY)
    onClose?.()
  }

  const counts = {
    packages: results.packages.length,
    hotels:   results.hotels.length,
    blogs:    results.blogs.length,
  }
  const hasResults = counts.packages + counts.hotels + counts.blogs > 0
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'packages', label: 'Packages' },
    { key: 'hotels',   label: 'Hotels'   },
    { key: 'blogs',    label: 'Blogs'    },
  ]
  // Only show tabs that have results
  const visibleTabs = tabs.filter(t => counts[t.key] > 0)

  return (
    <div ref={containerRef} className={cn('relative', className)}>

      {/* ── Input ── */}
      <div className="relative">
        <MagnifyingGlassIcon className={cn(
          'absolute left-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none z-10 transition-colors duration-300',
          isSolid ? 'text-neutral-400' : 'text-white/70'
        )} />

        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          type='text'
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search packages, hotels, blogs…"
          className={cn(
            'w-full rounded-full py-2.5 pl-10 pr-9 text-sm outline-none ring-1 ring-inset transition-all duration-300',
            isSolid
              ? 'bg-white text-neutral-900 ring-neutral-300 shadow-md shadow-gray-200/70 placeholder:text-neutral-400 focus:ring-2 focus:ring-primary-400'
              : 'bg-white/15 text-white ring-white/30 placeholder:text-white/70 backdrop-blur-sm focus:bg-white/20 focus:ring-white/50'
          )}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center">
          {loading ? (
            <div className="size-4 rounded-full border-2 border-neutral-200 border-t-primary-500 animate-spin" />
          ) : query ? (
            <button type="button" onClick={clear} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
              <XMarkIcon className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Dropdown ── */}
      {open && query.length >= 2 && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-[min(500px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl shadow-neutral-300/40 ring-1 ring-neutral-100 overflow-hidden z-200 shadow-lg">

          {!hasResults ? (
            <div className="flex flex-col items-center py-10 gap-2 text-neutral-400">
              <MagnifyingGlassIcon className="size-8 opacity-30" />
              <p className="text-sm font-medium text-neutral-600">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs">Try different keywords</p>
            </div>
          ) : (
            <>
              {/* ── Tab bar ── */}
              <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-neutral-100">
                {visibleTabs.map(t => (
                  <Tab
                    key={t.key}
                    label={t.label}
                    count={counts[t.key]}
                    active={activeTab === t.key}
                    onClick={() => setActiveTab(t.key)}
                  />
                ))}
              </div>

              {/* ── Results ── */}
              <div className="p-2 max-h-72 overflow-y-auto">

                {activeTab === 'packages' && results.packages.map(p => (
                  <Link
                    key={p.id}
                    href={`/packages/${p.slug}`}
                    scroll={false}
                    onClick={closeDropdown}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                  >
                    <Thumb src={p.thumbnail} alt={p.title} fallback={<SuitcaseRolling weight="duotone" className="size-5 text-neutral-300" />} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{p.title}</p>
                      {p.destination && <p className="text-xs text-neutral-400 mt-0.5 truncate">{p.destination.name}</p>}
                    </div>
                    <ArrowRightIcon className="size-3.5 text-neutral-300 group-hover:text-primary-400 shrink-0 transition-colors" />
                  </Link>
                ))}

                {activeTab === 'hotels' && results.hotels.map(h => (
                  <Link
                    key={h.id}
                    href={`/hotels/${h.slug}`}
                    onClick={closeDropdown}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                  >
                    <Thumb src={h.thumbnail} alt={h.name} fallback={<BuildingOffice2Icon className="size-5 text-neutral-300" />} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{h.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">
                        {[h.city, h.state].filter(Boolean).join(', ')}{h.category ? ` · ${h.category}` : ''}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-3.5 text-neutral-300 group-hover:text-primary-400 shrink-0 transition-colors" />
                  </Link>
                ))}

                {activeTab === 'blogs' && results.blogs.map(b => (
                  <Link
                    key={b.id}
                    href={`/blogs/${b.slug}`}
                    onClick={closeDropdown}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                  >
                    <Thumb src={b.cover_image} alt={b.title} fallback={<BookOpenIcon className="size-5 text-neutral-300" />} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{b.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">
                        {b.excerpt ?? (b.read_time ? `${b.read_time} min read` : 'Blog post')}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-3.5 text-neutral-300 group-hover:text-primary-400 shrink-0 transition-colors" />
                  </Link>
                ))}

              </div>

              {/* ── View all footer ── */}
              <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50">
                <Link
                  href={`/${activeTab}?q=${encodeURIComponent(query)}`}
                  onClick={closeDropdown}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View all {activeTab} results for &ldquo;{query}&rdquo;
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
