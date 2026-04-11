'use client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PostWithAuthor } from '@/types/app'
import { useUser } from './useUser'

const PAGE_SIZE = 10

export function useFeed() {
  const { user } = useUser()

  return useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const supabase = createClient()
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data: rawData, error } = await supabase
        .from('posts')
        .select('*, author:profiles!author_id(*)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      const data = rawData as unknown as PostWithAuthor[]

      // Check which posts the current user has liked
      if (user && data) {
        const postIds = data.map((p) => p.id)
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds)
        const likedSet = new Set(likes?.map((l) => l.post_id) ?? [])
        return data.map((p) => ({ ...p, liked_by_me: likedSet.has(p.id) })) as PostWithAuthor[]
      }

      return (data ?? []) as PostWithAuthor[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  })
}
