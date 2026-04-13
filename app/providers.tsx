'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/lib/context/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }))

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
      } catch {
        // best-effort cleanup only
      }

      if (!('caches' in window)) return
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {
        // best-effort cleanup only
      }
    })()
  }, [])

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
