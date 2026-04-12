'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Vote, MessageSquare, Megaphone, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const NAV = [
  { label: 'Feed',    href: '/',        icon: LayoutGrid },
  { label: 'Vote',    href: '/vote',    icon: Vote },
  { label: 'Chat',    href: '/chat',    icon: MessageSquare },
  { label: 'Info',    href: '/info',    icon: Megaphone },
  { label: 'Compete', href: '/compete', icon: Trophy },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 flex pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-medium transition-colors',
              active
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-slate-400 dark:text-slate-500'
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
