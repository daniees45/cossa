'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Hash, MessageSquare, Plus } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Channel, Profile } from '@/types/app'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channels')
        .select('*')
        .eq('type', 'public')
        .order('name')
      return (data ?? []) as Channel[]
    },
  })

  const { data: dmUsers } = useQuery({
    queryKey: ['dm-users', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      // Get recent DM partners
      const { data } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .not('receiver_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!data) return []
      const ids = [...new Set(
        data.flatMap((m) => [m.sender_id, m.receiver_id]).filter((id) => id && id !== user!.id)
      )]
      if (ids.length === 0) return []

      const { data: profiles } = await supabase.from('profiles').select('*').in('id', (ids.filter(Boolean) as string[]).slice(0, 10))
      return (profiles ?? []) as Profile[]
    },
  })

  return (
    <div className="flex h-full">
      {/* Channel list sidebar */}
      <div className={cn(
        'w-full md:w-64 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0',
        pathname !== '/chat' && 'hidden md:flex'
      )}>
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="px-3 mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-2">Channels</p>
            {channels?.map((ch) => (
              <Link
                key={ch.id}
                href={`/chat/${ch.id}`}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition',
                  pathname === `/chat/${ch.id}`
                    ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Hash size={15} className="shrink-0" />
                {ch.name}
              </Link>
            ))}
          </div>

          {/* DMs */}
          {dmUsers && dmUsers.length > 0 && (
            <div className="px-3 mt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-2">Direct Messages</p>
              {dmUsers.map((u) => (
                <Link
                  key={u.id}
                  href={`/chat/dm/${u.id}`}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition',
                    pathname === `/chat/dm/${u.id}`
                      ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                  <span className="truncate">{u.full_name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className={cn(
        'flex-1 min-w-0',
        pathname === '/chat' && 'hidden md:flex'
      )}>
        {children}
      </div>
    </div>
  )
}
