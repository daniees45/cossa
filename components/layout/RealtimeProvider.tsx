'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { useUser } from '@/lib/hooks/useUser'
import { useChatStore } from '@/lib/stores/chatStore'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime()

  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const { user } = useUser()
  const qc = useQueryClient()
  const {
    incDmUnread,
    incChannelUnread,
    setChannelUnread,
    replaceDmUnread,
    replaceChannelUnread,
    syncDmReadHighWatermark,
  } = useChatStore()

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!user) return

    let fired = false

    const logoutOnClose = () => {
      if (fired) return
      fired = true

      const url = '/api/auth/logout'
      const payload = JSON.stringify({ reason: 'page_close' })

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const ok = navigator.sendBeacon(url, payload)
        if (ok) return
      }

      void fetch(url, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: payload,
      })
    }

    window.addEventListener('pagehide', logoutOnClose)
    window.addEventListener('beforeunload', logoutOnClose)

    return () => {
      window.removeEventListener('pagehide', logoutOnClose)
      window.removeEventListener('beforeunload', logoutOnClose)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    let active = true
    void (async () => {
      const [{ data: dmRows }, { data: channelRows, error: channelErr }] = await Promise.all([
        supabase
          .from('messages')
          .select('sender_id')
          .eq('receiver_id', user.id)
          .is('read_at', null),
        supabase.rpc('get_channel_unread_counts'),
      ])

      if (!active) return

      const dmCounts: Record<string, number> = {}
      for (const row of dmRows ?? []) {
        dmCounts[row.sender_id] = (dmCounts[row.sender_id] ?? 0) + 1
      }
      replaceDmUnread(dmCounts)

      const channelCounts: Record<string, number> = {}
      if (!channelErr && channelRows) {
        for (const row of channelRows as Array<{ channel_id: string; unread_count: number }>) {
          channelCounts[row.channel_id] = row.unread_count
        }
      }
      replaceChannelUnread(channelCounts)
      qc.setQueryData(['channel-unread'], channelCounts)
      qc.setQueryData(['dm-unread'], dmCounts)
    })()

    const topic = `global-chat-unread-${user.id}-${Date.now()}`
    const ch = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as {
            channel_id: string | null
            sender_id: string
            receiver_id: string | null
            created_at: string
          }

          if (row.channel_id) {
            if (row.sender_id === user.id) return
            if (pathnameRef.current === `/chat/${row.channel_id}`) {
              setChannelUnread(row.channel_id, 0)
              return
            }
            incChannelUnread(row.channel_id)
            return
          }

          if (!row.receiver_id || row.receiver_id !== user.id) return
          if (pathnameRef.current === `/chat/dm/${row.sender_id}`) {
            void syncDmReadHighWatermark({
              currentUserId: user.id,
              peerUserId: row.sender_id,
              readAt: row.created_at,
            })
            return
          }
          incDmUnread(row.sender_id)
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(ch)
    }
  }, [
    user,
    qc,
    incDmUnread,
    incChannelUnread,
    setChannelUnread,
    replaceDmUnread,
    replaceChannelUnread,
    syncDmReadHighWatermark,
  ])

  return <>{children}</>
}
