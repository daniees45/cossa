'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function NavigationProgress() {
  const pathname = usePathname()
  const [width, setWidth]   = useState(0)
  const [opacity, setOpacity] = useState(0)
  const active     = useRef(false)
  const interval   = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (interval.current)  { clearInterval(interval.current);  interval.current  = null }
    if (fadeTimer.current) { clearTimeout(fadeTimer.current);   fadeTimer.current = null }
  }

  function start() {
    clearTimers()
    active.current = true
    setOpacity(1)
    setWidth(12)
    let w = 12
    interval.current = setInterval(() => {
      w += (94 - w) * 0.12
      setWidth(w)
    }, 180)
  }

  function complete() {
    clearTimers()
    active.current = false
    setWidth(100)
    fadeTimer.current = setTimeout(() => {
      setOpacity(0)
      fadeTimer.current = setTimeout(() => setWidth(0), 300)
    }, 200)
  }

  // Pathname change = navigation finished
  useEffect(() => {
    if (!active.current) return
    complete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Intercept internal-link clicks to start
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        href.startsWith('tel') ||
        a.target === '_blank'
      ) return
      start()
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-1 overflow-visible"
      style={{
        width: `${width}%`,
        opacity,
        transition: 'width 200ms ease-out, opacity 300ms ease',
      }}
    >
      <div className="nav-progress-shimmer h-full w-full rounded-r-full bg-violet-500" />
      {opacity > 0 && (
        <span className="nav-progress-glow pointer-events-none absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-[40%] rounded-full bg-violet-400" />
      )}
    </div>
  )
}
