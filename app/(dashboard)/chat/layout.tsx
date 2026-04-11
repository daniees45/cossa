'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Hash, Plus, X } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Channel, Profile } from '@/types/app'
import { useChatStore } from '@/lib/stores/chatStore'
import { useEffect, useState, useRef } from 'react'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()
  const { dmUnread, clearDmUnread, channelUnread, setChannelUnread } = useChatStore()

  // New DM search
  const [showDmSearch, setShowDmSearch] = useState(false)
  const [dmSearch, setDmSearch] = useState('')
  const [dmSearchResults, setDmSearchResults] = useState<Profile[]>([])
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Initial DM unread counts from DB (stale=Infinity, refreshed by invalidation)
  const { data: dbUnread } = useQuery({
    queryKey: ['dm-unread'],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user!.id)
        .is('read_at', null)
      if (!data) return {} as Record<string, number>
      const counts: Record<string, number> = {}
      for (const m of data) {
        counts[m.sender_id] = (counts[m.sender_id] ?? 0) + 1
      }
      return counts
    },
  })

  // Clear channel unread when visiting the channel page
  useEffect(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/)
    if (match && match[1] !== 'dm') {
      setChannelUnread(match[1], false)
    }
  }, [pathname, setChannelUnread])

  // DM user search
  useEffect(() => {
    if (!dmSearch.trim() || !user) {
      setDmSearchResults([])
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .or(`full_name.ilike.%${dmSearch}%,username.ilike.%${dmSearch}%`)
        .limit(5)
      setDmSearchResults((data as Profile[]) ?? [])
    }, 250)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [dmSearch, user])

  function totalUnreadFor(userId: string) {
    return (dbUnread?.[userId] ?? 0) + (dmUnread[userId] ?? 0)
  }

  function navigateToDm(uid: string) {
    clearDmUnread(uid)
    qc.invalidateQueries({ queryKey: ['dm-unread'] })
    router.push(`/chat/dm/${uid}`)
    setShowDmSearch(false)
    setDmSearch('')
  }

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
                <span className="truncate flex-1">{ch.name}</span>
                {channelUnread[ch.id] && pathname !== `/chat/${ch.id}` && (
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                )}
              </Link>
            ))}
          </div>

          {/* DMs */}
          <div className="px-3 mt-4">
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direct Messages</p>
              <button
                onClick={() => setShowDmSearch(true)}
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-violet-500 transition"
                title="Start new DM"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* DM search */}
            {showDmSearch && (
              <div className="mb-2">
                <div className="relative">
                  <input
                    value={dmSearch}
                    onChange={(e) => setDmSearch(e.target.value)}
                    placeholder="Search users…"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setShowDmSearch(false); setDmSearch('') }
                    }}
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 pr-7"
                  />
                  <button
                    onClick={() => { setShowDmSearch(false); setDmSearch('') }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                {dmSearchResults.length > 0 && (
                  <div className="mt-1 space-y-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {dmSearchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => navigateToDm(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition"
                      >
                        <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{u.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dmUsers?.map((u) => {
              const unread = totalUnreadFor(u.id)
              const isActive = pathname === `/chat/dm/${u.id}`
              return (
                <button
                  key={u.id}
                  onClick={() => navigateToDm(u.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition text-left',
                    isActive
                      ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                  <span className="truncate flex-1">{u.full_name}</span>
                  {unread > 0 && !isActive && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
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

