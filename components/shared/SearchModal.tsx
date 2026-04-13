'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, X, User, FileText, Loader2, Clock3, ArrowUpRight, Compass, MessageSquare, Tv2, Vote } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Profile, Post } from '@/types/app'

interface SearchResult {
  users: Profile[]
  posts: (Post & { author: Pick<Profile, 'full_name' | 'avatar_url' | 'username'> })[]
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

const RECENT_SEARCHES_KEY = 'ccossa-recent-searches'

const TOP_CATEGORIES = [
  { label: 'Upcoming Events', hint: 'What is next on campus', href: '/entertain', icon: Tv2 },
  { label: 'Find Students', hint: 'Discover people in COSSA', href: '/people', icon: User },
  { label: 'Account Settings', hint: 'Edit profile and account', href: '/profile/edit', icon: Compass },
  { label: 'People', hint: 'Profiles and members', href: '/people', icon: User },
  { label: 'Feed', hint: 'Posts and updates', href: '/', icon: Compass },
  { label: 'Chat', hint: 'Channels and DMs', href: '/chat', icon: MessageSquare },
  { label: 'Entertainment', hint: 'Events and gallery', href: '/entertain', icon: Tv2 },
  { label: 'Vote', hint: 'Elections and polls', href: '/vote', icon: Vote },
]

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] })
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 5) : [])
      }
    } catch {
      setRecentSearches([])
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults({ users: [], posts: [] })
      setFocused(true)
      const first = window.setTimeout(() => inputRef.current?.focus(), 30)
      const second = window.setTimeout(() => inputRef.current?.focus(), 140)
      document.body.style.overflow = 'hidden'
      return () => {
        window.clearTimeout(first)
        window.clearTimeout(second)
        document.body.style.overflow = ''
      }
    } else {
      document.body.style.overflow = ''
      setFocused(false)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ users: [], posts: [] })
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const term = `%${q.trim()}%`
      const [{ data: users }, { data: posts }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, level, department')
          .or(`full_name.ilike.${term},username.ilike.${term}`)
          .limit(5),
        supabase
          .from('posts')
          .select('id, content, created_at, author:profiles!author_id(full_name, avatar_url, username)')
          .ilike('content', term)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      setResults({
        users: (users ?? []) as Profile[],
        posts: (posts ?? []) as unknown as SearchResult['posts'],
      })
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  function navigate(href: string) {
    router.push(href)
    onClose()
  }

  function persistRecentSearch(nextQuery: string) {
    const normalized = nextQuery.trim()
    if (normalized.length < 2) return
    const next = [normalized, ...recentSearches.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5)
    setRecentSearches(next)
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    } catch {
      // ignore storage availability issues
    }
  }

  function submitQuery() {
    const normalized = query.trim()
    if (normalized.length < 2) return
    persistRecentSearch(normalized)
    void search(normalized)
  }

  const showDiscovery = query.trim().length < 2 && !loading
  const keyboardItems = showDiscovery
    ? [
        ...recentSearches.map((item) => ({
          key: `recent-${item}`,
          action: () => {
            setQuery(item)
            void search(item)
          },
        })),
        ...TOP_CATEGORIES.map(({ href }) => ({
          key: `category-${href}`,
          action: () => navigate(href),
        })),
      ]
    : [
        ...results.users.map((user) => ({
          key: `user-${user.id}`,
          action: () => {
            persistRecentSearch(query)
            navigate(`/profile/${user.username}`)
          },
        })),
        ...results.posts.map((post) => ({
          key: `post-${post.id}`,
          action: () => {
            persistRecentSearch(query)
            navigate(`/social/${post.id}`)
          },
        })),
      ]

  const hasResults = results.users.length > 0 || results.posts.length > 0
  const showEmpty = query.trim().length >= 2 && !loading && !hasResults

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1)
      return
    }
    setActiveIndex(keyboardItems.length > 0 ? 0 : -1)
  }, [keyboardItems.length, open, query, loading])

  useEffect(() => {
    if (activeIndex < 0) return
    const activeEl = document.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-4 sm:px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[min(84dvh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white/96 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/96 sm:rounded-[1.75rem]"
      >
        {/* Input */}
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-700 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600/80 dark:text-violet-300/80">Omni Search</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">People, posts, and shortcuts in one place</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200/80 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          <div className={cn(
            'flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition duration-200 dark:border-slate-700 dark:bg-slate-800/80',
            focused && 'scale-[1.01] border-violet-300/90 ring-2 ring-violet-500/20 shadow-[0_12px_30px_rgba(124,58,237,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-violet-700/80'
          )}>
            {query ? <X size={18} className="shrink-0 text-violet-500" /> : <Search size={18} className="shrink-0 text-slate-400" />}
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  if (keyboardItems.length === 0) return
                  event.preventDefault()
                  setActiveIndex((current) => (current + 1) % keyboardItems.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  if (keyboardItems.length === 0) return
                  event.preventDefault()
                  setActiveIndex((current) => (current <= 0 ? keyboardItems.length - 1 : current - 1))
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (activeIndex >= 0 && keyboardItems[activeIndex]) {
                    keyboardItems[activeIndex].action()
                    return
                  }
                  submitQuery()
                }
              }}
              placeholder="Search people, posts, or jump to a section"
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
            />
            {loading && <Loader2 size={15} className="animate-spin shrink-0 text-slate-400" />}
            {!loading && query && (
              <button
                onClick={() => { setQuery(''); setResults({ users: [], posts: [] }) }}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
            <kbd className="hidden rounded-full border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(226,232,240,0.9))] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500 shadow-sm dark:border-slate-600 dark:bg-[linear-gradient(180deg,rgba(51,65,85,0.95),rgba(30,41,59,0.9))] dark:text-slate-300 sm:inline">
              ⏎ Search
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {showDiscovery && (
            <div className="space-y-5 px-4 py-5 sm:px-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Clock3 size={13} className="text-slate-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent searches</p>
                </div>
                {recentSearches.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item, index) => (
                      <button
                        key={item}
                        data-search-index={index}
                        onClick={() => {
                          setQuery(item)
                          void search(item)
                        }}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          activeIndex === index
                            ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                            : 'border-slate-200/80 bg-slate-50 text-slate-600 hover:border-violet-300 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Recent searches will appear here once you start exploring.</p>
                )}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top categories</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOP_CATEGORIES.map(({ label, hint, href, icon: Icon }, index) => {
                    const itemIndex = recentSearches.length + index
                    return (
                    <button
                      key={href}
                      data-search-index={itemIndex}
                      onClick={() => navigate(href)}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left shadow-sm transition',
                        activeIndex === itemIndex
                          ? 'border-violet-300 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-900/20'
                          : 'border-slate-200/80 bg-white/90 hover:border-violet-300 hover:bg-violet-50/50 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-violet-700 dark:hover:bg-violet-900/20'
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
                        <p className="text-xs text-slate-400">{hint}</p>
                      </div>
                      <ArrowUpRight size={14} className="text-slate-300" />
                    </button>
                    )})}
                </div>
              </div>
            </div>
          )}

          {showEmpty && (
            <p className="text-sm text-slate-400 text-center py-8">No results for &ldquo;{query}&rdquo;</p>
          )}

          {results.users.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">People</p>
              {results.users.map((u, index) => (
                <button
                  key={u.id}
                  data-search-index={index}
                  onClick={() => {
                    persistRecentSearch(query)
                    navigate(`/profile/${u.username}`)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 transition text-left',
                    activeIndex === index
                      ? 'bg-violet-50 dark:bg-violet-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{u.full_name}</p>
                    <p className="text-xs text-slate-400">@{u.username}{u.level ? ` · ${u.level} Level` : ''}</p>
                  </div>
                  <User size={13} className="ml-auto text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {results.posts.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Posts</p>
              {results.posts.map((p, index) => {
                const itemIndex = results.users.length + index
                return (
                <button
                  key={p.id}
                  data-search-index={itemIndex}
                  onClick={() => {
                    persistRecentSearch(query)
                    navigate(`/social/${p.id}`)
                  }}
                  onMouseEnter={() => setActiveIndex(itemIndex)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 transition text-left',
                    activeIndex === itemIndex
                      ? 'bg-violet-50 dark:bg-violet-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <Avatar src={p.author.avatar_url} name={p.author.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400 mb-0.5">@{p.author.username}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{p.content}</p>
                  </div>
                  <FileText size={13} className="mt-0.5 text-slate-300 shrink-0" />
                </button>
              )})}
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                <kbd className="font-semibold text-slate-500 dark:text-slate-300">↑↓</kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                <kbd className="font-semibold text-slate-500 dark:text-slate-300">Enter</kbd>
                open
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                <kbd className="font-semibold text-slate-500 dark:text-slate-300">Esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
