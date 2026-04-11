'use client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PostWithAuthor } from '@/types/app'
import { useUser } from './useUser'

export type FeedMode = 'all' | 'following' | 'saved'

const PAGE_SIZE = 10

export function useFeed(mode: FeedMode = 'all') {
  const { user } = useUser()

  return useInfiniteQuery({
    queryKey: ['feed', mode],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const supabase = createClient()
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      // ── Saved tab: query post_bookmarks, then join posts ──────────────────
      if (mode === 'saved') {
        if (!user) return []
        const { data: bmData } = await supabase
          .from('post_bookmarks')
          .select('post_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to)
        const postIds = (bmData ?? []).map((b) => b.post_id)
        if (postIds.length === 0) return []
        const { data: rawData } = await supabase
          .from('posts')
          .select('*, author:profiles!author_id(*)')
          .in('id', postIds)
        const data = (rawData ?? []) as unknown as PostWithAuthor[]
        const postIdsSet = new Set(postIds)
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)
        const likedSet = new Set(likes?.map((l) => l.post_id) ?? [])
        return data
          .sort((a, b) => postIds.indexOf(a.id) - postIds.indexOf(b.id))
          .map((p) => ({
            ...p,
            liked_by_me: likedSet.has(p.id),
            bookmarked_by_me: postIdsSet.has(p.id),
          })) as PostWithAuthor[]
      }

      // ── Following tab: filter by author ──────────────────────────────────
      let authorFilter: string[] | null = null
      if (mode === 'following' && user) {
        const { data: followData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id)
        const ids = (followData ?? []).map((r) => r.following_id)
        ids.push(user.id)
        authorFilter = ids
        if (ids.length === 0) return []
      }

      // ── For You / Following base query ────────────────────────────────────
      let query = supabase
        .from('posts')
        .select('*, author:profiles!author_id(*)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (authorFilter) {
        query = query.in('author_id', authorFilter)
      }

      const { data: rawData, error } = await query
      if (error) throw error
      const data = rawData as unknown as PostWithAuthor[]

      if (user && data.length > 0) {
        const postIds = data.map((p) => p.id)
        const [{ data: likes }, { data: bookmarks }] = await Promise.all([
          supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('post_bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ])
        const likedSet = new Set(likes?.map((l) => l.post_id) ?? [])
        const bookmarkedSet = new Set(bookmarks?.map((b) => b.post_id) ?? [])
        return data.map((p) => ({
          ...p,
          liked_by_me: likedSet.has(p.id),
          bookmarked_by_me: bookmarkedSet.has(p.id),
        })) as PostWithAuthor[]
      }

      return (data ?? []) as PostWithAuthor[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  })
}
