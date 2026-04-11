import { create } from 'zustand'

interface ChatState {
  /** senderId → unread count (realtime-incremented) */
  dmUnread: Record<string, number>
  /** channelId → unread count since last visit */
  channelUnread: Record<string, number>

  incDmUnread: (senderId: string) => void
  clearDmUnread: (senderId?: string) => void   // no arg = clear all
  incChannelUnread: (channelId: string) => void
  setChannelUnread: (channelId: string, count: number) => void
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

  incChannelUnread: (channelId) =>
    set((s) => ({ channelUnread: { ...s.channelUnread, [channelId]: (s.channelUnread[channelId] ?? 0) + 1 } })),

  setChannelUnread: (channelId, count) =>
    set((s) => ({ channelUnread: { ...s.channelUnread, [channelId]: count } })),
}))

