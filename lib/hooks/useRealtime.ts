'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useUser } from './useUser'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useChatStore } from '@/lib/stores/chatStore'
import type { PostWithAuthor } from '@/types/app'

export function useRealtime() {
  const { user } = useUser()
  const { addNotification } = useNotificationStore()
  const { incDmUnread } = useChatStore()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    const channel = supabase
      .channel('app-realtime')
      // ── Notifications ────────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          addNotification(payload.new as never)
        }
      )
      // ── Post UPDATE: sync likes_count + comments_count into feed cache ───────
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const updated = payload.new as {
            id: string
            likes_count: number
            comments_count: number
          }
          qc.setQueriesData<InfiniteData<PostWithAuthor[]>>(
            { queryKey: ['feed'] },
            (old) => {
              if (!old) return old
              return {
                ...old,
                pages: old.pages.map((page) =>
                  page.map((post) =>
                    post.id === updated.id
                      ? {
                          ...post,
                          likes_count: updated.likes_count,
                          comments_count: updated.comments_count,
                        }
                      : post
                  )
                ),
              }
            }
          )
        }
      )
      // ── Post DELETE: remove from feed cache ───────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          qc.setQueriesData<InfiniteData<PostWithAuthor[]>>(
            { queryKey: ['feed'] },
            (old) => {
              if (!old) return old
              return {
                ...old,
                pages: old.pages.map((page) =>
                  page.filter((post) => post.id !== deletedId)
                ),
              }
            }
          )
        }
      )
      // ── DM unread: increment when a DM arrives for the current user ──────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          incDmUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, addNotification, incDmUnread, qc])
}
