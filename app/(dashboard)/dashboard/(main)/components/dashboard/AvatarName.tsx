// app/(dashboard)/dashboard/(main)/components/dashboard/AvatarName.tsx

"use client"

import React, { useState, useRef, useEffect, useTransition } from 'react'
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from '../ui/avatar'
import { User, Settings, Bell, LogOut } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { signOutEmployee } from '@/app/lib/auth-dashboard-actions'

interface AvatarNameProps {
  name?: string
  role?: string 
  email?: string
  avatarSrc?: string
}

const AvatarName = ({
  name = "Mayank Sharma",
  role = "Marketing head",
  email = "mayank@dreamsyatri.com",
  avatarSrc,                              // ← no default here
}: AvatarNameProps) => {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const DEFAULT_AVATAR = "/dashboard/profile.jpg"
  const src = avatarSrc?.trim() || DEFAULT_AVATAR 

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

    const handleSignOut = () => {
    setOpen(false)
    startTransition(async () => {
        await signOutEmployee() // ← calls the server action
    })
    }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-1.5 rounded-full border border-transparent',
          'transition-all duration-150 cursor-pointer select-none',
          'hover:bg-accent hover:border-border',
          'active:scale-[0.98]',
          open && 'bg-accent border-border'
        )}
      >
        <Avatar className="h-9 w-9 ring-[1.5px] ring-border ring-offset-2 ring-offset-background">
          <AvatarImage src={src} alt={name} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          <AvatarBadge className="bg-green-500 border-background" />
        </Avatar>
        <div className="text-left">
          <p className="text-sm font-medium leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground leading-tight">{role}</p>
        </div>
        <svg
          className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ml-0.5', open && 'rotate-180')}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div className={cn(
        'absolute right-0 top-[calc(100%+8px)] z-50 min-w-[200px]',
        'bg-popover border border-border rounded-xl shadow-md overflow-hidden',
        'transition-all duration-150 origin-top-right',
        open
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 scale-[0.97] -translate-y-1 pointer-events-none'
      )}>
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
          <Avatar className="h-8 w-8">
            <AvatarImage src={src} alt={name} />
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-tight">{name}</p>
            <p className="text-xs text-muted-foreground leading-tight">{email}</p>
          </div>
        </div>

        <div className="p-1.5 border-b border-border">
          {[
            { icon: User, label: 'View profile', href: '/dashboard/profile' },
            { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
            { icon: Bell, label: 'Notifications', href: '/dashboard/notifications', badge: 3 },
          ].map(({ icon: Icon, label, href, badge }) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors duration-100"
            >
              <Icon className="w-4 h-4 opacity-60" />
              {label}
              {badge && (
                <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {badge}
                </span>
              )}
            </a>
          ))}
        </div>

        <div className="p-1.5">
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvatarName