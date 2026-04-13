'use client'
import Link from 'next/link'
import { Bell, Search, Sun, Moon, LogOut, User, Settings, X, MessageSquare, Megaphone, CheckCircle2, AlertTriangle, BellOff, Loader2, Hash } from 'lucide-react'
import { useTheme } from '@/lib/context/ThemeProvider'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useUser } from '@/lib/hooks/useUser'
import { getInitials } from '@/lib/utils/uploadFile'
import { cn } from '@/lib/utils/cn'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Notification } from '@/types/app'
import { useSiteBranding } from '@/lib/hooks/useSiteBranding'

const VISIBLE_NOTIFICATION_TYPES = [
  'broadcast',
  'comment',
  'channel_creation_approved',
  'channel_creation_rejected',
  'channel_join_approved',
  'channel_join_rejected',
  'system',
]

const QUICK_ACTIONS = [
  { id: 'action-chat', label: 'Open Chat', subtitle: 'Channels and direct messages', href: '/chat' },
  { id: 'action-people', label: 'Find People', subtitle: 'Browse members and profiles', href: '/people' },
  { id: 'action-feed', label: 'Go to Feed', subtitle: 'See latest posts and updates', href: '/' },
  { id: 'action-entertainment', label: 'Open Entertainment', subtitle: 'Events and gallery', href: '/entertain' },
]

type SearchSuggestion = {
  id: string
  label: string
  subtitle: string
  href: string
  kind: 'user' | 'channel' | 'action'
}

export function Topbar() {
  const { unreadCount, notifications, markAllRead, markOneRead, setNotifications } = useNotificationStore()
  const { user } = useUser()
  const { branding } = useSiteBranding()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchingInline, setSearchingInline] = useState(false)
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showMobileHelper, setShowMobileHelper] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const mobileSearchWrapRef = useRef<HTMLDivElement>(null)
  const desktopSearchWrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)
  const router = useRouter()
  const pathname = usePathname()

  // Cmd+K / Ctrl+K shortcut to focus inline search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Load notifications on mount
  useEffect(() => {
    if (!user) return
    setNotificationsLoading(true)
    const supabase = createClient()
    let cancelled = false

    const load = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .in('type', VISIBLE_NOTIFICATION_TYPES)
          .order('created_at', { ascending: false })
          .limit(20)
        if (!cancelled && data) setNotifications(data as Notification[])
      } finally {
        if (!cancelled) setNotificationsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [user, setNotifications])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      const insideMobileSearch = mobileSearchWrapRef.current?.contains(e.target as Node)
      const insideDesktopSearch = desktopSearchWrapRef.current?.contains(e.target as Node)
      if (!insideMobileSearch && !insideDesktopSearch) setSearchDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Always dismiss overlays when navigating to another page.
  useEffect(() => {
    setOpen(false)
    setUserMenuOpen(false)
    setSearchDropdownOpen(false)
    const main = document.getElementById('dashboard-main')
    main?.focus({ preventScroll: true })
  }, [pathname])

  useEffect(() => {
    const term = searchQuery.trim().toLowerCase()
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    const filteredActions = QUICK_ACTIONS
      .filter((action) => {
        if (!term) return true
        return `${action.label} ${action.subtitle}`.toLowerCase().includes(term)
      })
      .slice(0, 4)
      .map((action) => ({ ...action, kind: 'action' as const }))

    if (term.length < 2) {
      setSearchSuggestions(filteredActions)
      setSearchSuggestionsLoading(false)
      setActiveSuggestionIndex(filteredActions.length > 0 ? 0 : -1)
      return
    }

    setSearchSuggestionsLoading(true)
    const requestId = ++searchRequestRef.current

    searchDebounceRef.current = setTimeout(() => {
      const supabase = createClient()
      const like = `%${term}%`

      Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name')
          .or(`full_name.ilike.${like},username.ilike.${like}`)
          .limit(5),
        supabase
          .from('channels')
          .select('id, name, description')
          .or(`name.ilike.${like},description.ilike.${like}`)
          .limit(5),
      ])
        .then(([profilesResult, channelsResult]) => {
          if (searchRequestRef.current !== requestId) return
          const users = (profilesResult.data ?? []).map((u: { id: string; username: string; full_name: string | null }) => ({
            id: `user-${u.id}`,
            label: u.full_name || u.username,
            subtitle: `@${u.username}`,
            href: `/profile/${u.username}`,
            kind: 'user' as const,
          }))

          const channels = (channelsResult.data ?? []).map((c: { id: string; name: string; description: string | null }) => ({
            id: `channel-${c.id}`,
            label: `#${c.name}`,
            subtitle: c.description || 'Open chat channel',
            href: `/chat/${c.id}`,
            kind: 'channel' as const,
          }))

          const nextSuggestions = [...users, ...channels, ...filteredActions].slice(0, 10)
          setSearchSuggestions(nextSuggestions)
          setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1)
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) {
            setSearchSuggestionsLoading(false)
          }
        })
    }, 220)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

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

  function notificationTypeMeta(type: string) {
    if (type === 'comment') return { icon: MessageSquare, badgeClass: 'bg-violet-500', ringClass: 'text-violet-600 dark:text-violet-300' }
    if (type === 'broadcast') return { icon: Megaphone, badgeClass: 'bg-cyan-500', ringClass: 'text-cyan-600 dark:text-cyan-300' }
    if (type.includes('approved')) return { icon: CheckCircle2, badgeClass: 'bg-emerald-500', ringClass: 'text-emerald-600 dark:text-emerald-300' }
    if (type.includes('rejected')) return { icon: AlertTriangle, badgeClass: 'bg-amber-500', ringClass: 'text-amber-600 dark:text-amber-300' }
    return { icon: Bell, badgeClass: 'bg-slate-500', ringClass: 'text-slate-600 dark:text-slate-300' }
  }

  async function handleMarkOneRead(id: string) {
    markOneRead(id)
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  function handleDismissNotification(id: string) {
    setNotifications(notifications.filter((n) => n.id !== id))
  }

  function handleChooseSuggestion(suggestion: SearchSuggestion) {
    router.push(suggestion.href)
    setSearchDropdownOpen(false)
    setSearchQuery('')
  }

  async function handleInlineSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (searchSuggestions.length > 0) {
      const picked = searchSuggestions[Math.max(0, activeSuggestionIndex)]
      if (picked) {
        handleChooseSuggestion(picked)
        return
      }
    }

    const term = searchQuery.trim()
    if (term.length < 2 || searchingInline) return

    setSearchingInline(true)
    try {
      const supabase = createClient()
      const like = `%${term}%`
      const [{ data: users }, { data: posts }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username')
          .or(`full_name.ilike.${like},username.ilike.${like}`)
          .limit(1),
        supabase
          .from('posts')
          .select('id')
          .ilike('content', like)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const topUser = users?.[0] as { username?: string } | undefined
      const topPost = posts?.[0] as { id?: string } | undefined

      if (topUser?.username) {
        router.push(`/profile/${topUser.username}`)
        return
      }

      if (topPost?.id) {
        router.push(`/social/${topPost.id}`)
        return
      }

      router.push('/people')
    } finally {
      setSearchingInline(false)
    }
  }

  const renderSearchDropdown = (mobile: boolean) => {
    if (!searchDropdownOpen) return null
    return (
      <div
        className={cn(
          'absolute top-full z-[70] mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95',
          mobile ? 'left-0 right-0' : 'left-0 right-0'
        )}
        role="listbox"
        aria-label="Search suggestions"
      >
        {searchSuggestionsLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 size={12} className="animate-spin" />
            Loading suggestions...
          </div>
        )}
        {!searchSuggestionsLoading && searchSuggestions.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No suggestions yet</div>
        )}
        {searchSuggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={index === activeSuggestionIndex}
            onMouseEnter={() => setActiveSuggestionIndex(index)}
            onClick={() => handleChooseSuggestion(suggestion)}
            className={cn(
              'flex w-full items-start gap-2.5 px-3 py-2 text-left transition',
              index === activeSuggestionIndex ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'
            )}
          >
            <span className="mt-0.5 shrink-0 text-slate-400">
              {suggestion.kind === 'user' && <User size={14} />}
              {suggestion.kind === 'channel' && <Hash size={14} />}
              {suggestion.kind === 'action' && <Search size={14} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{suggestion.label}</span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{suggestion.subtitle}</span>
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <header className="relative sticky top-0 z-40 flex h-14 min-w-0 items-center gap-1.5 border-b border-slate-200/70 bg-[var(--site-bg,#f8fafc)]/88 px-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur dark:border-slate-700/70 dark:bg-[var(--site-bg-dark,#020617)]/84 min-[370px]:gap-2 min-[370px]:px-3 sm:gap-3 sm:px-4 md:px-6">
      {/* COSSA logo - mobile only */}
      <div className="mr-0.5 flex min-w-0 items-center gap-1.5 md:hidden sm:mr-1 sm:gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center overflow-hidden">
          {branding.logoUrl
            ? <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
            : <span className="text-white font-bold text-xs">{(branding.siteTitle[0] || 'C').toUpperCase()}</span>}
        </div>
        <span className="hidden max-w-20 truncate text-sm font-bold leading-normal text-slate-900 dark:text-white min-[340px]:inline min-[370px]:max-w-none">{branding.siteTitle}</span>
      </div>

      {/* Mobile inline search */}
      <div ref={mobileSearchWrapRef} className="relative mr-0.5 min-w-0 basis-0 flex-1 md:hidden min-[370px]:mr-1">
        <form
          onSubmit={handleInlineSearchSubmit}
          className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/85 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md transition duration-200 focus-within:border-violet-300/90 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800/80 min-[370px]:gap-2 min-[370px]:px-2.5"
          aria-label="Inline search"
        >
          <span className="relative h-4 w-4 shrink-0 text-violet-500">
            {searchingInline || searchSuggestionsLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </span>
          <input
            value={searchQuery}
            onFocus={() => setSearchDropdownOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchDropdownOpen(true)
            }}
            onKeyDown={(e) => {
              if (!searchDropdownOpen || searchSuggestions.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveSuggestionIndex((i) => (i + 1) % searchSuggestions.length)
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveSuggestionIndex((i) => (i <= 0 ? searchSuggestions.length - 1 : i - 1))
              }
            }}
            placeholder="Search"
            aria-label="Search people, channels, or actions"
            className="min-w-[11ch] flex-1 bg-transparent text-xs font-medium text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-200 dark:placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </form>
        {renderSearchDropdown(true)}
      </div>

      {/* Search */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden w-[min(40rem,calc(100%-22rem))] -translate-x-1/2 -translate-y-1/2 md:block lg:w-[min(44rem,calc(100%-24rem))]">
        <div ref={desktopSearchWrapRef} className="pointer-events-auto relative">
          <form
            onSubmit={handleInlineSearchSubmit}
            className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md transition duration-200 focus-within:border-violet-300/90 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800/75"
            aria-label="Inline search"
          >
            <span className="relative h-4 w-4 shrink-0 text-violet-500">
              {searchingInline || searchSuggestionsLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onFocus={() => setSearchDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchDropdownOpen(true)
              }}
              onKeyDown={(e) => {
                if (!searchDropdownOpen || searchSuggestions.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveSuggestionIndex((i) => (i + 1) % searchSuggestions.length)
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveSuggestionIndex((i) => (i <= 0 ? searchSuggestions.length - 1 : i - 1))
                }
              }}
              placeholder="Search people, channels, or actions"
              aria-label="Search people, channels, or actions"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium leading-normal text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-200 dark:placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <kbd className="hidden rounded-full border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(226,232,240,0.9))] px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500 shadow-sm dark:border-slate-600 dark:bg-[linear-gradient(180deg,rgba(51,65,85,0.95),rgba(30,41,59,0.9))] dark:text-slate-300 lg:inline">
              ⌘K
            </kbd>
          </form>
          {renderSearchDropdown(false)}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 min-[370px]:gap-1.5 sm:gap-2.5">
        {/* Dark mode toggle */}
        <div className="max-[329px]:hidden">
          <ThemeToggle />
        </div>
        {/* Notification Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close notifications' : 'Open notifications'}
            className="relative rounded-xl p-1.5 transition hover:bg-slate-100 min-[370px]:p-2 dark:hover:bg-slate-800 sm:p-2.5"
          >
            <Bell size={18} className="text-slate-600 dark:text-slate-300 sm:h-5 sm:w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Inbox</p>
                  <p className="text-[11px] text-slate-400">{unreadCount} unread</p>
                </div>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs font-medium text-violet-600 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {notificationsLoading && (
                  <div className="space-y-2 px-4 py-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
                    ))}
                  </div>
                )}
                {!notificationsLoading && notifications.length === 0 && (
                  <div className="px-4 py-9 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                      <BellOff size={16} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inbox is quiet</p>
                    <p className="mt-1 text-xs text-slate-400">New alerts and activity will show up here.</p>
                  </div>
                )}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.read) {
                        await handleMarkOneRead(n.id)
                      }
                      if (n.link) router.push(n.link)
                      setOpen(false)
                    }}
                    className={cn(
                      'group cursor-pointer px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/50',
                      !n.read && 'bg-violet-50/70 dark:bg-violet-900/12'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200">
                          {n.title.slice(0, 1).toUpperCase()}
                        </div>
                        <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-white dark:border-slate-800', notificationTypeMeta(n.type).badgeClass)}>
                          {(() => {
                            const Icon = notificationTypeMeta(n.type).icon
                            return <Icon size={9} />
                          })()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                        <p className="mt-0.5 truncate text-xs leading-normal text-slate-500">{n.body}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                            {!n.read && (
                              <button
                                onClick={async (event) => {
                                  event.stopPropagation()
                                  await handleMarkOneRead(n.id)
                                }}
                                className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300"
                              >
                                Read
                              </button>
                            )}
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDismissNotification(n.id)
                              }}
                              className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 min-[340px]:block" aria-hidden="true" />

        {/* Avatar */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label={userMenuOpen ? 'Close account menu' : 'Open account menu'}
              className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-xs font-bold text-white ring-2 ring-transparent transition hover:ring-violet-300 sm:h-8 sm:w-8"
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
      className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 min-[370px]:p-2 dark:text-slate-400 dark:hover:bg-slate-800 sm:p-2.5"
      title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {resolvedTheme === 'dark' ? <Sun size={17} className="sm:h-[18px] sm:w-[18px]" /> : <Moon size={17} className="sm:h-[18px] sm:w-[18px]" />}
    </button>
  )
}
