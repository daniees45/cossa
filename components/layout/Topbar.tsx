'use client'
import Link from 'next/link'
import { Bell, Search, Sun, Moon, LogOut, User, Settings } from 'lucide-react'
import { useTheme } from '@/lib/context/ThemeProvider'
import { SearchModal } from '@/components/shared/SearchModal'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useUser } from '@/lib/hooks/useUser'
import { getInitials } from '@/lib/utils/uploadFile'
import { cn } from '@/lib/utils/cn'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Notification } from '@/types/app'

const VISIBLE_NOTIFICATION_TYPES = [
  'broadcast',
  'comment',
  'channel_creation_approved',
  'channel_creation_rejected',
  'channel_join_approved',
  'channel_join_rejected',
  'system',
]

export function Topbar() {
  const { unreadCount, notifications, markAllRead, markOneRead, setNotifications } = useNotificationStore()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showMobileHelper, setShowMobileHelper] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Cmd+K / Ctrl+K shortcut to open search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Load notifications on mount
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .in('type', VISIBLE_NOTIFICATION_TYPES)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[])
      })
  }, [user, setNotifications])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Always dismiss overlays when navigating to another page.
  useEffect(() => {
    setOpen(false)
    setSearchOpen(false)
    setUserMenuOpen(false)
    const main = document.getElementById('dashboard-main')
    main?.focus({ preventScroll: true })
  }, [pathname])

  // Mobile helper row: show once, auto-dismiss after a few seconds,
  // and permanently hide after first user interaction.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 639px)').matches) return

    const key = 'topbar-mobile-helper-dismissed'
    try {
      if (window.localStorage.getItem(key) === '1') return
    } catch {
      // ignore storage availability issues
    }

    setShowMobileHelper(true)

    const dismiss = () => {
      setShowMobileHelper(false)
      try {
        window.localStorage.setItem(key, '1')
      } catch {
        // ignore storage availability issues
      }
    }

    const autoTimer = window.setTimeout(dismiss, 5200)
    const onFirstInteraction = () => dismiss()

    window.addEventListener('pointerdown', onFirstInteraction, { once: true })
    window.addEventListener('keydown', onFirstInteraction, { once: true })
    window.addEventListener('touchstart', onFirstInteraction, { once: true })

    return () => {
      window.clearTimeout(autoTimer)
      window.removeEventListener('pointerdown', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
      window.removeEventListener('touchstart', onFirstInteraction)
    }
  }, [])

  async function handleMarkAllRead() {
    markAllRead()
    if (!user) return
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .in('type', VISIBLE_NOTIFICATION_TYPES)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 min-w-0 items-center gap-2 border-b border-slate-200/90 bg-white/90 px-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/88 sm:gap-3 sm:px-4 md:px-6">
      {/* COSSA logo - mobile only */}
      <div className="mr-0.5 flex min-w-0 items-center gap-2 md:hidden sm:mr-1">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-xs">C</span>
        </div>
        <span className="max-w-20 truncate text-sm font-bold leading-normal text-slate-900 dark:text-white min-[370px]:max-w-none">COSSA</span>
      </div>

      {/* Search */}
      <div
        onClick={() => setSearchOpen(true)}
        className={cn(
          'hidden max-w-sm flex-1 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md transition duration-200 sm:flex',
          searchOpen
            ? 'scale-[1.01] border-violet-300/90 ring-2 ring-violet-500/20 shadow-[0_12px_30px_rgba(124,58,237,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-violet-700/80 dark:bg-slate-800/80'
            : 'hover:border-slate-300 hover:bg-white/90 dark:border-slate-700 dark:bg-slate-800/65 dark:hover:bg-slate-800/85'
        )}
      >
        <Search size={15} className="shrink-0 text-violet-500" />
        <span className="flex-1 text-sm font-medium leading-normal text-slate-600 dark:text-slate-300">Search people, posts, or jump anywhere</span>
        <kbd className="hidden rounded-full border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(226,232,240,0.9))] px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500 shadow-sm dark:border-slate-600 dark:bg-[linear-gradient(180deg,rgba(51,65,85,0.95),rgba(30,41,59,0.9))] dark:text-slate-300 lg:inline">
          ⌘K
        </kbd>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Open search"
          className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 sm:hidden"
          title="Search"
        >
          <Search size={18} />
        </button>
        {/* Dark mode toggle */}
        <ThemeToggle />
        {/* Notification Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close notifications' : 'Open notifications'}
            className="relative rounded-xl p-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bell size={20} className="text-slate-600 dark:text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-violet-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-8">No notifications yet</p>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) {
                        markOneRead(n.id)
                        const supabase = createClient()
                        await supabase.from('notifications').update({ read: true }).eq('id', n.id)
                      }
                      if (n.link) router.push(n.link)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition',
                      !n.read && 'bg-violet-50 dark:bg-violet-900/10'
                    )}
                  >
                    <div className="w-2 h-2 rounded-full bg-violet-500 mt-2 shrink-0 opacity-0 data-[unread=true]:opacity-100" data-unread={!n.read} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                      <p className="text-xs leading-normal text-slate-500 mt-0.5 truncate">{n.body}</p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

        {/* Avatar */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label={userMenuOpen ? 'Close account menu' : 'Open account menu'}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-xs font-bold text-white ring-2 ring-transparent transition hover:ring-violet-300"
              title="Account menu"
            >
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                : getInitials(user.full_name)}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-700">
                  <p className="truncate text-sm leading-normal font-semibold text-slate-900 dark:text-white">{user.full_name}</p>
                  <p className="truncate text-xs leading-normal text-slate-400">@{user.username}</p>
                </div>

                <div className="p-1.5">
                  <Link
                    href={`/profile/${user.username}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <User size={14} />
                    Profile
                  </Link>

                  <Link
                    href="/profile/edit"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Settings size={14} />
                    Edit profile
                  </Link>

                  {user.role === 'super_admin' && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Settings size={14} />
                      Admin settings
                    </Link>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showMobileHelper && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-2 top-full mt-1.5 grid grid-cols-4 gap-1 rounded-xl border border-slate-200/80 bg-white/85 px-2 py-1 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur sm:hidden"
        >
          <span className="text-center">Search</span>
          <span className="text-center">Theme</span>
          <span className="text-center">Alerts</span>
          <span className="text-center">Account</span>
        </div>
      )}
    </header>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
