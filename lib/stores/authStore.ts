'use client'
import { create } from 'zustand'
import type { Profile } from '@/types/app'

interface AuthState {
  user: Profile | null
  setUser: (user: Profile | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))
