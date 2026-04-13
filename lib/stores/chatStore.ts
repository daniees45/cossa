import { createClient } from '@/lib/supabase/client'
import { create } from 'zustand'

interface ChatState {
  /** senderId → unread count (realtime-incremented) */
  dmUnread: Record<string, number>
  /** channelId → unread count since last visit */
  channelUnread: Record<string, number>
  /** peer user id -> latest read watermark ISO timestamp */
  dmLastReadAt: Record<string, string>

  replaceDmUnread: (counts: Record<string, number>) => void
  replaceChannelUnread: (counts: Record<string, number>) => void
  incDmUnread: (senderId: string) => void
  clearDmUnread: (senderId?: string) => void   // no arg = clear all
  markDmReadWatermark: (peerUserId: string, readAt?: string) => void
  syncDmReadHighWatermark: (args: { currentUserId: string; peerUserId: string; readAt?: string }) => Promise<void>
  incChannelUnread: (channelId: string) => void
  setChannelUnread: (channelId: string, count: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  dmUnread: {},
  channelUnread: {},
  dmLastReadAt: {},

  replaceDmUnread: (counts) => set({ dmUnread: counts }),

  replaceChannelUnread: (counts) => set({ channelUnread: counts }),

  incDmUnread: (senderId) =>
    set((s) => ({ dmUnread: { ...s.dmUnread, [senderId]: (s.dmUnread[senderId] ?? 0) + 1 } })),

  clearDmUnread: (senderId) =>
    set((s) => {
      if (!senderId) return { dmUnread: {} }
      const { [senderId]: _, ...rest } = s.dmUnread
      return { dmUnread: rest }
    }),

  markDmReadWatermark: (peerUserId, readAt) => {
    const stamp = readAt ?? new Date().toISOString()
    set((s) => {
      const prev = s.dmLastReadAt[peerUserId]
      if (prev && new Date(prev).getTime() >= new Date(stamp).getTime()) {
        return {
          dmUnread: { ...s.dmUnread, [peerUserId]: 0 },
        }
      }
      return {
        dmUnread: { ...s.dmUnread, [peerUserId]: 0 },
        dmLastReadAt: { ...s.dmLastReadAt, [peerUserId]: stamp },
      }
    })
  },

  syncDmReadHighWatermark: async ({ currentUserId, peerUserId, readAt }) => {
    const stamp = readAt ?? new Date().toISOString()
    const previous = get().dmLastReadAt[peerUserId]
    if (previous && new Date(previous).getTime() >= new Date(stamp).getTime()) {
      set((s) => ({ dmUnread: { ...s.dmUnread, [peerUserId]: 0 } }))
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('messages')
      .update({ read_at: stamp })
      .eq('sender_id', peerUserId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null)
      .lte('created_at', stamp)

    if (!error) {
      set((s) => ({
        dmUnread: { ...s.dmUnread, [peerUserId]: 0 },
        dmLastReadAt: { ...s.dmLastReadAt, [peerUserId]: stamp },
      }))
    }
  },

  incChannelUnread: (channelId) =>
    set((s) => ({ channelUnread: { ...s.channelUnread, [channelId]: (s.channelUnread[channelId] ?? 0) + 1 } })),

  setChannelUnread: (channelId, count) =>
    set((s) => ({ channelUnread: { ...s.channelUnread, [channelId]: count } })),
}))

