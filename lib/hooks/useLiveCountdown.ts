'use client'
import { useState, useEffect } from 'react'
import { countdown } from '@/lib/utils/formatDate'

export function useLiveCountdown(endsAt: string | undefined): string {
  const [label, setLabel] = useState<string>(() => (endsAt ? countdown(endsAt) : ''))

  useEffect(() => {
    if (!endsAt) return
    setLabel(countdown(endsAt))
    const id = setInterval(() => setLabel(countdown(endsAt)), 60_000)
    return () => clearInterval(id)
  }, [endsAt])

  return label
}
