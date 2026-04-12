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
    queryKey: ['feed', mode, user?.id ?? null],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const supabase = createClient()
      if (mode === 'saved' && !user) return []
      if (mode === 'following' && !user) return []

      const { data: rawData, error } = await supabase.rpc('get_feed_with_user_status', {
        p_mode: mode,
        p_page: pageParam as number,
        p_page_size: PAGE_SIZE,
      })
      if (error) throw error

      return (rawData ?? []) as unknown as PostWithAuthor[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
  })
}
