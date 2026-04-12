'use client'
import { useFeed, type FeedMode } from '@/lib/hooks/useFeed'
import { PostCard } from '@/components/social/PostCard'
import { PostEditor } from '@/components/social/PostEditor'
import { FeedSkeleton } from '@/components/social/FeedSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { SuggestedUsers } from '@/components/social/SuggestedUsers'
import { TrendingTopics } from '@/components/social/TrendingTopics'
import { LayoutGrid, Loader2, Users, Bookmark, ArrowUp, Megaphone } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import type { PostWithAuthor } from '@/types/app'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const TABS: { id: FeedMode; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'For You', icon: <LayoutGrid size={14} /> },
  { id: 'following', label: 'Following', icon: <Users size={14} /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark size={14} /> },
]

const EMPTY_STATE: Record<FeedMode, { title: string; description: string }> = {
  all: { title: 'Nothing here yet', description: 'Be the first to post something for the COSSA community!' },
  following: { title: 'No posts yet', description: 'Follow people from the "Who to follow" section to see their posts here.' },
  saved: { title: 'No saved posts', description: 'Tap the bookmark icon on any post to save it here for later.' },
}

export default function FeedPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const [mode, setMode] = useState<FeedMode>('all')
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed(mode)
  const [localPosts, setLocalPosts] = useState<PostWithAuthor[]>([])
  const [newCount, setNewCount] = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)
  const feedTopRef = useRef<HTMLDivElement>(null)

  const allPosts = data?.pages.flatMap((p) => p) ?? []

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['feed-broadcasts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, link, created_at')
        .eq('user_id', user!.id)
        .eq('type', 'broadcast')
        .order('created_at', { ascending: false })
        .limit(20)

      const dedup = new Map<string, { id: string; title: string; body: string; link: string | null; created_at: string }>()
      for (const row of data ?? []) {
        const key = `${row.title}::${row.body}`
        if (!dedup.has(key)) {
          dedup.set(key, row)
        }
      }
      return Array.from(dedup.values()).slice(0, 3)
    },
  })

  const feed = [
    ...localPosts.filter((lp) => !allPosts.find((p) => p.id === lp.id)),
    ...allPosts,
  ]

  // ── Infinite scroll ─────────────────────────────────────────────────────────
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect])

  // ── Realtime new-posts listener (only on "For You" tab) ─────────────────────
  useEffect(() => {
    if (mode !== 'all') {
      setNewCount(0)
      return
    }
    const supabase = createClient()
    const knownIds = new Set([...localPosts, ...allPosts].map((p) => p.id))

    const ch = supabase
      .channel('realtime-feed-new-posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const id = (payload.new as { id: string }).id
          if (knownIds.has(id)) return
          if (user && (payload.new as { author_id: string }).author_id === user.id) return
          setNewCount((c) => c + 1)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.id])

  // Reset new count & local posts when tab changes
  useEffect(() => {
    setLocalPosts([])
    setNewCount(0)
  }, [mode])

  function loadNewPosts() {
    setNewCount(0)
    setLocalPosts([])
    qc.invalidateQueries({ queryKey: ['feed', mode] })
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Main feed column */}
        <div className="min-w-0 space-y-5" ref={feedTopRef}>

          <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.88))] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600/80 dark:text-cyan-300/80">Campus Feed</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Stories, wins, memes, and moments.</h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  A cleaner stream for COSSA conversations with faster posting, softer hierarchy, and more room for visuals.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-2 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{feed.length}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Loaded</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{broadcasts.length}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Broadcasts</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{newCount}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">New</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-950/5 p-1.5 dark:bg-white/5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    'flex min-w-fit flex-1 items-center justify-center gap-2 rounded-[1rem] px-3 py-2.5 text-sm font-medium transition whitespace-nowrap',
                    mode === tab.id
                      ? 'bg-white text-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.12)] dark:bg-slate-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
                  )}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'saved' && mode !== 'saved' && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">beta</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {broadcasts.length > 0 && (
            <section className="space-y-2">
              {broadcasts.map((b) => (
                <div key={b.id} className="rounded-[1.4rem] border border-cyan-200/60 bg-[linear-gradient(145deg,rgba(236,254,255,0.95),rgba(207,250,254,0.82))] px-4 py-3 shadow-[0_12px_30px_rgba(8,145,178,0.08)] dark:border-cyan-900/40 dark:bg-[linear-gradient(145deg,rgba(8,47,73,0.55),rgba(17,94,89,0.32))]">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-full bg-white/80 p-1.5 shadow-sm dark:bg-slate-900/60">
                      <Megaphone size={14} className="text-cyan-700 dark:text-cyan-300 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">{b.title}</p>
                      <p className="text-xs text-cyan-800/90 dark:text-cyan-100/90 mt-0.5">{b.body}</p>
                      {b.link && (
                        <a href={b.link} className="text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:underline mt-1 inline-block">
                          Open announcement
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* New posts banner */}
          {newCount > 0 && (
            <button
              onClick={loadNewPosts}
              className="flex w-full items-center justify-center gap-2 rounded-[1.3rem] bg-[linear-gradient(135deg,#0f172a,#7c3aed)] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_34px_rgba(109,40,217,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_42px_rgba(109,40,217,0.32)]"
            >
              <ArrowUp size={15} />
              {newCount} new post{newCount !== 1 ? 's' : ''} — tap to load
            </button>
          )}

          {/* Post editor (only on For You + Following tabs) */}
          {user && mode !== 'saved' && (
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-700/70 dark:bg-slate-900/92 sm:p-4">
              <PostEditor
                onPosted={(post) => {
                  setLocalPosts((prev) => [post, ...prev])
                  setNewCount(0)
                }}
              />
            </div>
          )}

          {/* Feed */}
          {isLoading ? (
            <FeedSkeleton />
          ) : feed.length === 0 ? (
            <EmptyState
              icon={mode === 'saved' ? <Bookmark size={24} /> : mode === 'following' ? <Users size={24} /> : <LayoutGrid size={24} />}
              title={EMPTY_STATE[mode].title}
              description={EMPTY_STATE[mode].description}
            />
          ) : (
            <div className="space-y-4">
              {feed.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => setLocalPosts((prev) => prev.filter((p) => p.id !== id))}
                />
              ))}
              <div ref={loaderRef} className="flex justify-center py-4">
                {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-violet-600" />}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden xl:flex w-72 shrink-0 flex-col gap-4 sticky top-6">
          <SuggestedUsers />
          <TrendingTopics />
        </aside>
      </div>
    </div>
  )
}
