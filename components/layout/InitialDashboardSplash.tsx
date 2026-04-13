'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SITE_BRANDING, type SiteBranding } from '@/lib/siteBranding'
import { createClient } from '@/lib/supabase/client'

// Minimum time (ms) the splash stays fully visible before it may fade out.
// Feed route waits for ccossa:feed-ready *and* MIN_VISIBLE before dismissing.
const MIN_VISIBLE_MS = 800
// Hard fallback — never block the UI longer than this.
const FALLBACK_MS = 8000

// Read the branding row once (no subscription needed – just for the splash logo).
async function fetchBrandingOnce(): Promise<SiteBranding> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('site_branding')
      .select('site_title, site_subtitle, logo_url, light_background, dark_background')
      .eq('id', 1)
      .single()
    if (!data) return DEFAULT_SITE_BRANDING
    return {
      siteTitle: data.site_title?.trim() || DEFAULT_SITE_BRANDING.siteTitle,
      siteSubtitle: data.site_subtitle?.trim() || DEFAULT_SITE_BRANDING.siteSubtitle,
      logoUrl: data.logo_url?.trim() || '',
      lightBackground: data.light_background || DEFAULT_SITE_BRANDING.lightBackground,
      darkBackground: data.dark_background || DEFAULT_SITE_BRANDING.darkBackground,
    }
  } catch {
    return DEFAULT_SITE_BRANDING
  }
}

export function InitialDashboardSplash() {
  // Three stages:
  //   'visible'  → full opacity, covering everything
  //   'fading'   → opacity-0, still covering the DOM so there's no content flash
  //   'gone'     → unmounted entirely
  const [stage, setStage] = useState<'visible' | 'fading' | 'gone'>('visible')
  const [branding, setBranding] = useState<SiteBranding>(DEFAULT_SITE_BRANDING)
  const pathname = usePathname()
  const dismissedRef = useRef(false)

  // Load branding logo as early as possible so the splash shows the real icon.
  useEffect(() => {
    void fetchBrandingOnce().then((b) => setBranding(b))
  }, [])

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()
    const isFeedRoute = pathname === '/'

    function dismiss() {
      if (cancelled || dismissedRef.current) return
      dismissedRef.current = true

      const elapsed = Date.now() - startedAt
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

      window.setTimeout(() => {
        if (cancelled) return
        // Start opacity fade — keep in DOM (stage='fading') for 500ms then remove.
        setStage('fading')
        window.setTimeout(() => {
          if (!cancelled) setStage('gone')
        }, 500)
      }, wait)
    }

    const fallback = window.setTimeout(dismiss, FALLBACK_MS)

    if (isFeedRoute) {
      window.addEventListener('ccossa:feed-ready', dismiss, { once: true })
      return () => {
        cancelled = true
        window.clearTimeout(fallback)
        window.removeEventListener('ccossa:feed-ready', dismiss)
      }
    }

    // Non-feed routes: wait for window.load, then apply MIN_VISIBLE gate.
    if (document.readyState === 'complete') {
      dismiss()
    } else {
      window.addEventListener('load', dismiss, { once: true })
    }

    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      window.removeEventListener('load', dismiss)
    }
  }, [pathname])

  if (stage === 'gone') return null

  const logoLetter = (branding.siteTitle[0] ?? 'C').toUpperCase()
  const hasLogo = branding.logoUrl.trim().length > 0

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center bg-white dark:bg-slate-950 transition-opacity duration-500"
      style={{ opacity: stage === 'fading' ? 0 : 1 }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-5">
        {/* Logo with heartbeat ring */}
        <div className="relative">
          {/* Outer heartbeat ring — pulses continuously to signal activity */}
          <motion.div
            className="absolute inset-0 rounded-[2.25rem] bg-violet-500/25 dark:bg-violet-400/20"
            animate={{ scale: [1, 1.22, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Second, slightly delayed ring for a true heartbeat feel */}
          <motion.div
            className="absolute inset-0 rounded-[2.25rem] bg-violet-400/20 dark:bg-violet-300/15"
            animate={{ scale: [1, 1.38, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.32 }}
          />

          {/* Logo box */}
          <motion.div
            animate={{ scale: [1, 1.035, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[2rem] bg-violet-600 shadow-[0_20px_50px_rgba(124,58,237,0.38)]"
          >
            {hasLogo ? (
              <img
                src={branding.logoUrl}
                alt={branding.siteTitle}
                className="h-full w-full object-cover"
                // If the logo URL fails, fall back to the letter
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span className="text-3xl font-black text-white select-none">{logoLetter}</span>
            )}
          </motion.div>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-xl font-black tracking-[0.22em] text-slate-900 dark:text-white">
            {branding.siteTitle.toUpperCase()}
          </p>
          <p className="mt-1.5 text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
            {branding.siteSubtitle || 'Loading campus experience'}
          </p>
        </div>

        {/* Indeterminate progress bar — always animating */}
        <div className="h-0.5 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <motion.div
            className="h-full w-1/3 rounded-full bg-violet-500"
            animate={{ x: ['calc(-100%)', 'calc(300%)'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  )
}