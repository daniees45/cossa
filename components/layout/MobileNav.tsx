'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Vote, MessageSquare, Megaphone, Trophy, UserPlus, Tv2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const NAV = [
  { label: 'Feed',    href: '/',        icon: LayoutGrid },
  { label: 'People',  href: '/people',  icon: UserPlus },
  { label: 'Vote',    href: '/vote',    icon: Vote },
  { label: 'Chat',    href: '/chat',    icon: MessageSquare },
  { label: 'Info',    href: '/info',    icon: Megaphone },
  { label: 'Entertainment', href: '/entertain', icon: Tv2 },
  { label: 'Compete', href: '/compete', icon: Trophy },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[var(--mobile-nav-height,calc(3.75rem+env(safe-area-inset-bottom)))] border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-8px_24px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/95 md:hidden" aria-label="Mobile navigation">
      <div className="subtle-scrollbar h-full overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max flex-row items-center justify-start gap-1.5 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 min-w-[6rem] shrink-0 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[10px] font-medium leading-normal transition-colors min-[380px]:text-[11px]',
                  active
                    ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
