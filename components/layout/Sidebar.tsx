'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  Vote,
  MessageSquare,
  Megaphone,
  Trophy,
  Tv2,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/uploadFile'
import { useEffect } from 'react'
import { useChatStore } from '@/lib/stores/chatStore'

const NAV = [
  { label: 'Feed',          href: '/',           icon: LayoutGrid },
  { label: 'Vote',          href: '/vote',        icon: Vote },
  { label: 'Chat',          href: '/chat',        icon: MessageSquare },
  { label: 'Info',          href: '/info',        icon: Megaphone },
  { label: 'Compete',       href: '/compete',     icon: Trophy },
  { label: 'Entertainment', href: '/entertain',   icon: Tv2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const { dmUnread, clearDmUnread } = useChatStore()

  // Clear DM unread badge when user navigates into chat
  useEffect(() => {
    if (pathname.startsWith('/chat')) {
      clearDmUnread()
    }
  }, [pathname, clearDmUnread])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-3">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-base">C</span>
        </div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-sm leading-none">COSSA</p>
          <p className="text-slate-400 text-xs mt-0.5">VVU CS Assoc.</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group',
                active
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Icon size={18} className={active ? 'text-violet-600' : 'opacity-70 group-hover:opacity-100'} />
              {label}
              {href === '/chat' && dmUnread > 0 && !active && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
              {active && <ChevronRight size={14} className="ml-auto text-violet-500" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: profile + logout */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
        {user && ['admin', 'super_admin'].includes(user.role) && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Settings size={18} />
            Admin
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition"
        >
          <LogOut size={18} />
          Sign out
        </button>
        {user && (
          <Link href={`/profile/${user.username}`} className="flex items-center gap-3 mt-4 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : getInitials(user.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.full_name}</p>
              <p className="text-xs text-slate-400 truncate">@{user.username}</p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  )
}
