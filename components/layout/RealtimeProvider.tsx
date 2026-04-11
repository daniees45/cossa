'use client'
import { useRealtime } from '@/lib/hooks/useRealtime'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime()
  return <>{children}</>
}
