'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Bell,
  BookOpen,
  Camera,
  Palette,
  FileText,
  Flag,
  Gavel,
  LayoutDashboard,
  Menu,
  Megaphone,
  MessageSquareLock,
  Trophy,
  Users,
} from 'lucide-react'
import { MobileSlideOver } from '@/components/shared/MobileSlideOver'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/events', label: 'Events', icon: Activity },
  { href: '/admin/competitions', label: 'Competitions', icon: Trophy },
  { href: '/admin/elections', label: 'Elections', icon: Gavel },
  { href: '/admin/channels', label: 'Channels', icon: MessageSquareLock },
  { href: '/admin/resources', label: 'Resources', icon: BookOpen },
  { href: '/admin/gallery', label: 'Gallery', icon: Camera },
  { href: '/admin/appearance', label: 'Appearance', icon: Palette },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit', icon: FileText },
]

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname.startsWith(href)
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="relative min-h-dvh bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl dark:bg-cyan-500/20" />
        <div className="absolute top-1/3 -right-16 h-80 w-80 rounded-full bg-emerald-500/15 blur-3xl dark:bg-emerald-500/20" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1400px] grid-cols-1 gap-4 px-3 pb-24 pt-4 md:gap-6 md:px-5 lg:grid-cols-[260px_1fr] lg:gap-8 lg:px-8 lg:py-8 lg:pb-8">
        <aside className="hidden lg:flex lg:flex-col">
          <div className="sticky top-8 space-y-4 rounded-[28px] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4 dark:border-cyan-300/20">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-200">Admin control</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Operations Deck</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Monitor, moderate, and publish from one place.</p>
            </div>

            <nav className="space-y-1.5">
              {ADMIN_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-300/40 dark:bg-cyan-400/20 dark:text-cyan-100 dark:ring-cyan-300/30'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">Admin</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Operations Deck</p>
              </div>
              <button
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Menu size={16} />
                Menu
              </button>
            </div>
          </div>

          <MobileSlideOver open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Admin menu">
            <div className="space-y-1 p-3">
              {ADMIN_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-300/40 dark:bg-cyan-400/20 dark:text-cyan-100 dark:ring-cyan-300/30'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </MobileSlideOver>

          <div className="admin-portal-skin rounded-[28px] border border-slate-200/80 bg-white/80 p-4 shadow-xl shadow-slate-300/25 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-2xl dark:shadow-black/20 md:p-6">
            {children}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Flag size={12} className="text-cyan-600 dark:text-cyan-300" />
            Administrative activity and security events are monitored continuously.
          </div>
        </main>
      </div>
    </div>
  )
}
