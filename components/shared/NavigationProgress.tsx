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
    setWidth(8)
    let w = 8
    interval.current = setInterval(() => {
      w += (92 - w) * 0.12
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
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-violet-500 pointer-events-none"
      style={{
        width: `${width}%`,
        opacity,
        boxShadow: opacity > 0 ? '0 0 10px rgba(139,92,246,0.7)' : 'none',
        transition: 'width 180ms ease-out, opacity 300ms ease',
      }}
    />
  )
}
