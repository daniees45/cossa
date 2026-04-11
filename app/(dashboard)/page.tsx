'use client'
import { useFeed } from '@/lib/hooks/useFeed'
import { PostCard } from '@/components/social/PostCard'
import { PostEditor } from '@/components/social/PostEditor'
import { FeedSkeleton } from '@/components/social/FeedSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { LayoutGrid, Loader2 } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import type { PostWithAuthor } from '@/types/app'
import { useState, useEffect, useCallback, useRef } from 'react'

export default function FeedPage() {
  const { user } = useUser()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed()
  const [localPosts, setLocalPosts] = useState<PostWithAuthor[]>([])
  const loaderRef = useRef<HTMLDivElement>(null)

  const allPosts = data?.pages.flatMap((p) => p) ?? []

  // Merge localPosts (optimistically added) with server data
  const feed = [
    ...localPosts.filter((lp) => !allPosts.find((p) => p.id === lp.id)),
    ...allPosts,
  ]

  // Infinite scroll
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  )

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      {/* Post editor */}
      {user && (
        <PostEditor
          onPosted={(post) => setLocalPosts((prev) => [post, ...prev])}
        />
      )}

      {/* Feed */}
      {isLoading ? (
        <FeedSkeleton />
      ) : feed.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={24} />}
          title="Nothing here yet"
          description="Be the first to post something for the COSSA community!"
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

          {/* Infinite scroll sentinel */}
          <div ref={loaderRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-violet-600" />}
          </div>
        </>
      )}
    </div>
  )
}
