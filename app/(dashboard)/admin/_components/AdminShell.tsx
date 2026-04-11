'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Bell,
  BookOpen,
  Camera,
  FileText,
  Flag,
  Gavel,
  LayoutDashboard,
  Megaphone,
  MessageSquareLock,
  Trophy,
  Users,
} from 'lucide-react'
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

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-16 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-6 px-3 pb-8 pt-4 md:px-5 lg:grid-cols-[260px_1fr] lg:gap-8 lg:px-8 lg:py-8">
        <aside className="hidden lg:flex lg:flex-col">
          <div className="sticky top-8 space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Admin control</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Operations Deck</h2>
              <p className="mt-1 text-xs text-slate-300">Monitor, moderate, and publish from one place.</p>
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
                        ? 'bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/30'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex gap-2 overflow-x-auto">
              {ADMIN_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      active ? 'bg-cyan-400/25 text-cyan-100' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon size={13} />
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="admin-portal-skin rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
            {children}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Flag size={12} className="text-cyan-300" />
            Administrative activity and security events are monitored continuously.
          </div>
        </main>
      </div>
    </div>
  )
}
