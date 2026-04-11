'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, X, User, FileText, Loader2 } from 'lucide-react'
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

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults({ users: [], posts: [] })
      setTimeout(() => inputRef.current?.focus(), 50)
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

  const hasResults = results.users.length > 0 || results.posts.length > 0
  const showEmpty = query.trim().length >= 2 && !loading && !hasResults

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search people or posts…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {loading && <Loader2 size={15} className="animate-spin text-slate-400 shrink-0" />}
          {query && !loading && (
            <button onClick={() => { setQuery(''); setResults({ users: [], posts: [] }) }}>
              <X size={15} className="text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 && (
            <p className="text-xs text-slate-400 text-center py-6">Type at least 2 characters to search</p>
          )}

          {showEmpty && (
            <p className="text-sm text-slate-400 text-center py-8">No results for &ldquo;{query}&rdquo;</p>
          )}

          {results.users.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">People</p>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => navigate(`/profile/${u.username}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
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
              {results.posts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/social/${p.id}`)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
                >
                  <Avatar src={p.author.avatar_url} name={p.author.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400 mb-0.5">@{p.author.username}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{p.content}</p>
                  </div>
                  <FileText size={13} className="mt-0.5 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {hasResults && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5">
              <p className="text-xs text-slate-400">Press Esc to close</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
