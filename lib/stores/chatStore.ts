import { create } from 'zustand'

interface ChatState {
  dmUnread: number
  incDmUnread: () => void
  clearDmUnread: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  dmUnread: 0,
  incDmUnread: () => set((s) => ({ dmUnread: s.dmUnread + 1 })),
  clearDmUnread: () => set({ dmUnread: 0 }),
}))
