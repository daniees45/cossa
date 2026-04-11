'use client'
import { useFeed, type FeedMode } from '@/lib/hooks/useFeed'
import { PostCard } from '@/components/social/PostCard'
import { PostEditor } from '@/components/social/PostEditor'
import { FeedSkeleton } from '@/components/social/FeedSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { SuggestedUsers } from '@/components/social/SuggestedUsers'
import { TrendingTopics } from '@/components/social/TrendingTopics'
import { LayoutGrid, Loader2, Users, Bookmark, ArrowUp } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import type { PostWithAuthor } from '@/types/app'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { useQueryClient } from '@tanstack/react-query'

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
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex gap-6 items-start">
        {/* Main feed column */}
        <div className="flex-1 min-w-0 space-y-4" ref={feedTopRef}>

          {/* Feed tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition',
                  mode === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'saved' && mode !== 'saved' && (
                  <span className="ml-0.5 text-xs text-violet-400">(β)</span>
                )}
              </button>
            ))}
          </div>

          {/* New posts banner */}
          {newCount > 0 && (
            <button
              onClick={loadNewPosts}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition shadow-lg animate-bounce-subtle"
            >
              <ArrowUp size={15} />
              {newCount} new post{newCount !== 1 ? 's' : ''} — tap to load
            </button>
          )}

          {/* Post editor (only on For You + Following tabs) */}
          {user && mode !== 'saved' && (
            <PostEditor
              onPosted={(post) => {
                setLocalPosts((prev) => [post, ...prev])
                setNewCount(0)
              }}
            />
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
            <>
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
            </>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0 sticky top-6">
          <SuggestedUsers />
          <TrendingTopics />
        </aside>
      </div>
    </div>
  )
}
