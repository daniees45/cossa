'use client'

import { useEffect } from 'react'
import { useSiteBranding } from '@/lib/hooks/useSiteBranding'

export function SiteBrandingRuntime() {
  const { branding } = useSiteBranding()

  useEffect(() => {
    document.documentElement.style.setProperty('--site-bg', branding.lightBackground)
    document.documentElement.style.setProperty('--site-bg-dark', branding.darkBackground)
  }, [branding.darkBackground, branding.lightBackground])

  return null
}
