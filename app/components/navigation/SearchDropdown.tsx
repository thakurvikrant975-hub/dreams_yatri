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

const EMPTY: SearchResults = { packages: [], hotels: [], blogs: [] }

interface Props {
  isSolid?:  boolean
  autoFocus?: boolean
  onClose?:  () => void
  className?: string
}

// ─── Thumbnail shell ─────────────────────────────────────────────────────────

function normalizeSrc(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) return src
  return `/${src}`
}

function Thumb({ src, alt, fallback }: { src: string | null; alt: string; fallback: React.ReactNode }) {
  const normalized = src ? normalizeSrc(src) : null
  return (
    <div className="size-11 rounded-xl overflow-hidden shrink-0 bg-neutral-100 flex items-center justify-center">
      {normalized
        ? <Image src={normalized} alt={alt} width={44} height={44} className="w-full h-full object-cover" />
        : fallback
      }
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SearchDropdown({ isSolid = true, autoFocus = false, onClose, className }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
    setQuery('')
    setResults(EMPTY)
    setOpen(false)
    inputRef.current?.focus()
  }

  function closeDropdown() {
    setOpen(false)
    setQuery('')
    setResults(EMPTY)
    onClose?.()
  }

  const hasResults = results.packages.length > 0 || results.hotels.length > 0 || results.blogs.length > 0
  const showDropdown = open && query.length >= 2

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

        {/* Spinner or clear button */}
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
      {showDropdown && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-[min(480px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl shadow-neutral-300/50 ring-1 ring-neutral-100 overflow-hidden z-200">

          {!hasResults ? (
            /* Empty state */
            <div className="flex flex-col items-center py-10 gap-2 text-neutral-400">
              <MagnifyingGlassIcon className="size-8 opacity-30" />
              <p className="text-sm font-medium text-neutral-600">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs">Try different keywords</p>
            </div>
          ) : (
            <div className="max-h-120 overflow-y-auto divide-y divide-neutral-100">

              {/* ── Packages ── */}
              {results.packages.length > 0 && (
                <section className="p-2">
                  <div className="flex items-center justify-between px-2 pt-1 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Packages</span>
                    <Link
                      href={`/packages?q=${encodeURIComponent(query)}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-0.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700"
                    >
                      View all <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {results.packages.map(p => (
                    <Link
                      key={p.id}
                      href={`/packages/${p.slug}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                    >
                      <Thumb
                        src={p.thumbnail}
                        alt={p.title}
                        fallback={<SuitcaseRolling weight="duotone" className="size-5 text-neutral-300" />}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{p.title}</p>
                        {p.destination && (
                          <p className="text-xs text-neutral-400 truncate mt-0.5">{p.destination.name}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </section>
              )}

              {/* ── Hotels ── */}
              {results.hotels.length > 0 && (
                <section className="p-2">
                  <div className="flex items-center justify-between px-2 pt-1 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Hotels</span>
                    <Link
                      href={`/hotels?q=${encodeURIComponent(query)}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-0.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700"
                    >
                      View all <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {results.hotels.map(h => (
                    <Link
                      key={h.id}
                      href={`/hotels/${h.slug}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                    >
                      <Thumb
                        src={h.thumbnail}
                        alt={h.name}
                        fallback={<BuildingOffice2Icon className="size-5 text-neutral-300" />}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{h.name}</p>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {[h.city, h.state].filter(Boolean).join(', ')}
                          {h.category ? ` · ${h.category}` : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </section>
              )}

              {/* ── Blogs ── */}
              {results.blogs.length > 0 && (
                <section className="p-2">
                  <div className="flex items-center justify-between px-2 pt-1 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Blogs</span>
                    <Link
                      href={`/blogs?q=${encodeURIComponent(query)}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-0.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700"
                    >
                      View all <ArrowRightIcon className="size-3" />
                    </Link>
                  </div>
                  {results.blogs.map(b => (
                    <Link
                      key={b.id}
                      href={`/blogs/${b.slug}`}
                      onClick={closeDropdown}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-neutral-50 transition-colors group"
                    >
                      <Thumb
                        src={b.cover_image}
                        alt={b.title}
                        fallback={<BookOpenIcon className="size-5 text-neutral-300" />}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600 transition-colors">{b.title}</p>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">
                          {b.excerpt ?? (b.read_time ? `${b.read_time} min read` : 'Blog post')}
                        </p>
                      </div>
                    </Link>
                  ))}
                </section>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
