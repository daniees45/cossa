import { create } from 'zustand'

interface ChatState {
  /** senderId → unread count (realtime-incremented) */
  dmUnread: Record<string, number>
  /** channelId → has unread since last visit */
  channelUnread: Record<string, boolean>

  incDmUnread: (senderId: string) => void
  clearDmUnread: (senderId?: string) => void   // no arg = clear all
  setChannelUnread: (channelId: string, hasUnread: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  dmUnread: {},
  channelUnread: {},

  incDmUnread: (senderId) =>
    set((s) => ({ dmUnread: { ...s.dmUnread, [senderId]: (s.dmUnread[senderId] ?? 0) + 1 } })),

  clearDmUnread: (senderId) =>
    set((s) => {
      if (!senderId) return { dmUnread: {} }
      const { [senderId]: _, ...rest } = s.dmUnread
      return { dmUnread: rest }
    }),

  setChannelUnread: (channelId, hasUnread) =>
    set((s) => ({ channelUnread: { ...s.channelUnread, [channelId]: hasUnread } })),
}))
