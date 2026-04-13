'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Hash, Plus, X, Users, ChevronRight, Lock } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import { ChannelAvatar } from '@/components/shared/ChannelAvatar'
import { cn } from '@/lib/utils/cn'
import type { Channel, Profile } from '@/types/app'
import { useChatStore } from '@/lib/stores/chatStore'
import { Spinner } from '@/components/shared/Spinner'
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'

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

  // Join preview state
  const [joinPreview, setJoinPreview] = useState<Channel | null>(null)
  const [previewMemberCount, setPreviewMemberCount] = useState<number | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [entryCode, setEntryCode] = useState('')
  const [showCreateRequest, setShowCreateRequest] = useState(false)
  const [creatingRequest, setCreatingRequest] = useState(false)
  const [requestForm, setRequestForm] = useState({
    name: '',
    description: '',
    type: 'public' as 'public' | 'private',
    private_join_mode: 'approval' as 'approval' | 'code',
    private_entry_code: '',
  })
  const { data: myChannelIds } = useQuery({
    queryKey: ['my-channel-memberships', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user!.id)
      return new Set((data ?? []).map((r) => r.channel_id))
    },
  })

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channels')
        .select('*')
        .in('type', ['public', 'private'])
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

  // Clear channel unread when visiting the channel page
  useEffect(() => {
    const match = pathname.match(/^\/chat\/([^/]+)$/)
    if (match && match[1] !== 'dm') {
      setChannelUnread(match[1], 0)
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
    return dmUnread[userId] ?? 0
  }

  function totalChannelUnreadFor(channelId: string) {
    return channelUnread[channelId] ?? 0
  }

  function navigateToDm(uid: string) {
    clearDmUnread(uid)
    router.push(`/chat/dm/${uid}`)
    setShowDmSearch(false)
    setDmSearch('')
  }

  async function handleChannelClick(ch: Channel) {
    if (!user) return
    // Already a member → go straight in
    if (myChannelIds?.has(ch.id) || pathname === `/chat/${ch.id}`) {
      router.push(`/chat/${ch.id}`)
      return
    }
    // Show join preview with description + member count
    setPreviewMemberCount(null)
    setJoinPreview(ch)
    setEntryCode('')
    const supabase = createClient()
    const { count } = await supabase
      .from('channel_members')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
    setPreviewMemberCount(count ?? 0)
  }

  async function confirmJoin() {
    if (!user || !joinPreview) return
    setJoinLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('request_channel_join', {
      p_channel_id: joinPreview.id,
      p_entry_code: entryCode.trim() || null,
    })
    setJoinLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }

    const result = data as { ok: boolean; joined?: boolean; pending?: boolean; error?: string }
    if (!result.ok) {
      toast.error(result.error ?? 'Could not join channel')
      return
    }

    if (result.pending) {
      toast.success('Join request sent. Await admin approval.')
      setJoinPreview(null)
      return
    }

    const target = joinPreview
    setPreviewMemberCount((c) => (c === null ? c : c + 1))
    setJoinPreview(null)
    qc.invalidateQueries({ queryKey: ['my-channel-memberships', user.id] })
    qc.invalidateQueries({ queryKey: ['channel-members', target.id] })
    router.push(`/chat/${target.id}`)
  }

  async function submitChannelRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const name = requestForm.name.trim()
    if (!name) return

    setCreatingRequest(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('request_channel_creation', {
      p_name: name,
      p_description: requestForm.description.trim() || null,
      p_type: requestForm.type,
      p_private_join_mode: requestForm.type === 'private' ? requestForm.private_join_mode : 'approval',
      p_private_entry_code:
        requestForm.type === 'private' && requestForm.private_join_mode === 'code'
          ? (requestForm.private_entry_code.trim() || null)
          : null,
    })
    setCreatingRequest(false)

    if (error) {
      toast.error(error.message)
      return
    }

    const result = data as { ok: boolean; error?: string }
    if (!result.ok) {
      toast.error(result.error ?? 'Could not submit channel request')
      return
    }

    toast.success('Channel request submitted for admin approval.')
    setShowCreateRequest(false)
    setRequestForm({ name: '', description: '', type: 'public', private_join_mode: 'approval', private_entry_code: '' })
  }

  return (
    <div className="flex flex-1 min-h-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.08),transparent_45%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.14),transparent_45%)]">
      {/* Channel list sidebar */}
      <div className={cn(
        'w-full md:w-[15rem] md:min-w-[15rem] md:border-r border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 flex flex-col shrink-0 min-h-0 backdrop-blur',
        pathname !== '/chat' && 'hidden md:flex'
      )}>
        <div className="border-b border-slate-100 dark:border-slate-800 bg-[linear-gradient(120deg,rgba(238,242,255,0.95),rgba(236,254,255,0.9))] px-4 py-4 dark:bg-[linear-gradient(120deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700/80 dark:text-cyan-300/80">Communication</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Messages</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Channels and direct chats</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 min-h-0">
          {/* Channels */}
          <div className="px-3 mb-3">
            <div className="mb-1 px-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
              <button
                onClick={() => setShowCreateRequest(true)}
                className="rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-500 transition hover:text-violet-600 dark:border-slate-700 dark:bg-slate-800"
                title="Request new channel"
              >
                Request
              </button>
            </div>
            {channels?.map((ch) => {
              const unread = totalChannelUnreadFor(ch.id)
              const isActive = pathname === `/chat/${ch.id}`
              const isMember = !!myChannelIds?.has(ch.id)
              const itemClass = cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm transition text-left border touch-manipulation',
                isActive
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 shadow-sm'
                  : 'border-transparent text-slate-600 dark:text-slate-400 md:hover:bg-slate-100 dark:md:hover:bg-slate-800'
              )

              if (isMember || isActive) {
                return (
                  <Link
                    key={ch.id}
                    href={`/chat/${ch.id}`}
                    onClick={() => setChannelUnread(ch.id, 0)}
                    className={itemClass}
                  >
                    <ChannelAvatar
                      name={ch.name}
                      avatar_url={ch.avatar_url}
                      emoji_icon={ch.emoji_icon}
                      color_hex={ch.color_hex ?? '#7c3aed'}
                      type={ch.type}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="truncate flex-1">{ch.name}</span>
                    {ch.type === 'private' && (
                      <Lock size={12} className="text-amber-500 shrink-0" />
                    )}
                    {unread > 0 && !isActive && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                )
              }

              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className={itemClass}
                >
                  <ChannelAvatar
                    name={ch.name}
                    avatar_url={ch.avatar_url}
                    emoji_icon={ch.emoji_icon}
                    color_hex={ch.color_hex ?? '#7c3aed'}
                    type={ch.type}
                    size="sm"
                    className="shrink-0"
                  />
                  <span className="truncate flex-1">{ch.name}</span>
                  {ch.type === 'private' && (
                    <Lock size={12} className="text-amber-500 shrink-0" />
                  )}
                  {unread > 0 && !isActive && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {!isActive && (
                    <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 font-medium px-1.5 py-0.5 rounded-full shrink-0">Join</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* DMs */}
          <div className="px-3 mt-5">
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direct Messages</p>
              <button
                onClick={() => setShowDmSearch(true)}
                className="rounded-full border border-slate-200/80 p-1 text-slate-400 transition hover:bg-slate-100 hover:text-violet-500 dark:border-slate-700 dark:hover:bg-slate-700"
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
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-base outline-none focus:ring-2 focus:ring-violet-500 pr-7"
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
                <Link
                  key={u.id}
                  href={`/chat/dm/${u.id}`}
                  onClick={() => clearDmUnread(u.id)}
                  className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm transition text-left border touch-manipulation',
                    isActive
                        ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 shadow-sm'
                      : 'border-transparent text-slate-600 dark:text-slate-400 md:hover:bg-slate-100 dark:md:hover:bg-slate-800'
                  )}
                >
                  <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                  <span className="truncate flex-1">{u.full_name}</span>
                  {unread > 0 && !isActive && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shrink-0">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className={cn(
        'flex-1 min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.09),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.14),transparent_40%)]',
        pathname === '/chat' && 'hidden md:flex'
      )}>
        {children}
      </div>

      {/* Channel join preview modal */}
      {joinPreview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:px-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="join-dialog-title"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setJoinPreview(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-[1.75rem] sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="px-6 pt-6 pb-4">
              <div className="mb-4">
                <ChannelAvatar
                  name={joinPreview.name}
                  avatar_url={joinPreview.avatar_url}
                  emoji_icon={joinPreview.emoji_icon}
                  color_hex={joinPreview.color_hex ?? '#7c3aed'}
                  type={joinPreview.type}
                  size="lg"
                />
              </div>
              <h2 id="join-dialog-title" className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                #{joinPreview.name}
              </h2>
              {joinPreview.description ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                  {joinPreview.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic mb-3">No description.</p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {previewMemberCount !== null
                    ? `${previewMemberCount} member${previewMemberCount !== 1 ? 's' : ''}`
                    : <Spinner size="xs" />}
                </span>
                <span className="capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">{joinPreview.type}</span>
                {joinPreview.type === 'private' && (
                  <span className="capitalize px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    {joinPreview.private_join_mode === 'code' ? 'entry code' : 'approval'}
                  </span>
                )}
              </div>

              {joinPreview.type === 'private' && joinPreview.private_join_mode === 'code' && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">Entry code</label>
                  <input
                    value={entryCode}
                    onChange={(e) => setEntryCode(e.target.value)}
                    placeholder="Enter private channel code"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 px-6 pb-5 justify-end">
              <button
                onClick={() => setJoinPreview(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmJoin}
                disabled={joinLoading || (joinPreview.type === 'private' && joinPreview.private_join_mode === 'code' && !entryCode.trim())}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 flex items-center gap-2 transition"
              >
                {joinLoading && <Spinner size="xs" className="border-white/30 border-t-white" />}
                {joinPreview.type === 'private' && joinPreview.private_join_mode === 'approval' ? 'Request access' : 'Join channel'}
                {!joinLoading && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel creation request modal */}
      {showCreateRequest && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:px-4" aria-modal="true" role="dialog" aria-labelledby="create-channel-request-title">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateRequest(false)} />
          <form
            onSubmit={submitChannelRequest}
            className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-[1.75rem] sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[calc(100dvh-2rem)] overflow-y-auto"
          >
            <div className="px-6 pt-6 pb-4 space-y-3">
              <h2 id="create-channel-request-title" className="text-base font-semibold text-slate-900 dark:text-white">
                Request a New Channel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your request will be reviewed by admins before the channel is created.
              </p>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Channel name</label>
                <input
                  value={requestForm.name}
                  onChange={(e) => setRequestForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. backend-lab"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea
                  value={requestForm.description}
                  onChange={(e) => setRequestForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is the channel for?"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['public', 'private'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRequestForm((f) => ({ ...f, type: t }))}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium capitalize',
                      requestForm.type === t
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {requestForm.type === 'private' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(['approval', 'code'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRequestForm((f) => ({ ...f, private_join_mode: mode }))}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-medium capitalize',
                          requestForm.private_join_mode === mode
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  {requestForm.private_join_mode === 'code' && (
                    <input
                      value={requestForm.private_entry_code}
                      onChange={(e) => setRequestForm((f) => ({ ...f, private_entry_code: e.target.value }))}
                      placeholder="Private channel entry code"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 px-6 pb-5 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateRequest(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingRequest || (requestForm.type === 'private' && requestForm.private_join_mode === 'code' && !requestForm.private_entry_code.trim())}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60"
              >
                {creatingRequest ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

