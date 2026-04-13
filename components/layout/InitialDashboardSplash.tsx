'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function InitialDashboardSplash() {
  const [visible, setVisible] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()
    const isFeedRoute = pathname === '/'

    const dismiss = () => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, 720 - elapsed)
      window.setTimeout(() => {
        if (!cancelled) setVisible(false)
      }, remaining)
    }

    if (isFeedRoute) {
      const onFeedReady = () => dismiss()
      window.addEventListener('ccossa:feed-ready', onFeedReady, { once: true })

      const fallbackTimer = window.setTimeout(dismiss, 6000)

      return () => {
        cancelled = true
        window.clearTimeout(fallbackTimer)
        window.removeEventListener('ccossa:feed-ready', onFeedReady)
      }
    }

    if (document.readyState === 'complete') {
      dismiss()
    } else {
      window.addEventListener('load', dismiss, { once: true })
    }

    const fallbackTimer = window.setTimeout(dismiss, 1400)

    return () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('load', dismiss)
    }
  }, [pathname])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center bg-white dark:bg-slate-950"
        >
          <motion.div
            initial={{ opacity: 0.88, scale: 0.92 }}
            animate={{ opacity: [0.78, 1, 0.82], scale: [0.96, 1.04, 0.98] }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-violet-600 text-3xl font-black text-white shadow-[0_20px_50px_rgba(124,58,237,0.35)]">
              C
            </div>
            <div className="text-center">
              <p className="text-xl font-black tracking-[0.24em] text-slate-900 dark:text-white">CCOSSA</p>
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">Loading campus experience</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}