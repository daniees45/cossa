'use client'
import React, { useEffect, useRef, useState, use } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { EnhancedAvatar } from '@/components/shared/EnhancedAvatar'
import { UserProfileModal } from '@/components/shared/UserProfileModal'
import { ChannelAvatar } from '@/components/shared/ChannelAvatar'
import { ChannelAvatarEditor } from '@/components/shared/ChannelAvatarEditor'
import {
  Send, ArrowLeft, Paperclip, Smile, Pencil, Trash2, X, Copy, ChevronDown, MessageCircle, Users, Settings, Bell, BellOff, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Channel, MessageWithSender } from '@/types/app'
import type { Database } from '@/types/database'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { useChatStore } from '@/lib/stores/chatStore'
import { useDialog } from '@/components/shared/DialogProvider'
import { Spinner } from '@/components/shared/Spinner'
import { MobileSlideOver } from '@/components/shared/MobileSlideOver'
import { toast } from 'sonner'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']
type Reaction = { emoji: string; count: number; byMe: boolean }
type ChannelMemberRole = Database['public']['Tables']['channel_members']['Row']['role']
type ChannelMemberInfo = {
  id: string
  full_name: string
  avatar_url: string | null
  username: string
  role: ChannelMemberRole
  isOwner: boolean
}
type ChannelJoinRequest = {
  id: string
  channel_id: string
  user_id: string
  created_at: string
  request_note: string | null
  user: { id: string; full_name: string; username: string; avatar_url: string | null }
}

type ChatStylePrefs = {
  fontFamily: 'default' | 'serif' | 'monospace'
  fontSize: '13' | '14' | '16' | '18'
  fontWeight: '400' | '500' | '600'
  textColor: string
}

function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}
function formatDay(iso: string) {
  const d = new Date(iso), today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (sameDay(iso, today.toISOString())) return 'Today'
  if (sameDay(iso, yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function hexToRgba(hex: string | null | undefined, alpha: number) {
  const safeHex = (hex ?? '#7c3aed').replace('#', '')
  const normalized = safeHex.length === 3
    ? safeHex.split('').map((c) => c + c).join('')
    : safeHex
  const value = Number.parseInt(normalized, 16)
  if (Number.isNaN(value)) return `rgba(124,58,237,${alpha})`
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params)
  const { user } = useUser()
  const qc = useQueryClient()
  const { setChannelUnread } = useChatStore()
  const { confirm } = useDialog()

  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // File attachment
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Edit / delete
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Reactions
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // Typing indicator
  const [showSettings, setShowSettings] = useState(false)
  const [members, setMembers] = useState<ChannelMemberInfo[]>([])
  const [channelNameDraft, setChannelNameDraft] = useState('')
  const [channelDescriptionDraft, setChannelDescriptionDraft] = useState('')
  const [channelAvatarDraft, setChannelAvatarDraft] = useState<string | null>(null)
  const [channelEmojiDraft, setChannelEmojiDraft] = useState<string | null>(null)
  const [channelColorDraft, setChannelColorDraft] = useState('#7c3aed')
  const [savingChannelDetails, setSavingChannelDetails] = useState(false)
  const [managingMemberId, setManagingMemberId] = useState<string | null>(null)
  const [reviewingJoinRequestId, setReviewingJoinRequestId] = useState<string | null>(null)
  const [mutedChannels, setMutedChannels] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('mutedChannels') ?? '[]') } catch { return [] }
  })

  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [mobileActionFor, setMobileActionFor] = useState<string | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [chatStyle, setChatStyle] = useState<ChatStylePrefs>({
    fontFamily: 'default',
    fontSize: '14',
    fontWeight: '400',
    textColor: '#111827',
  })
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastTypeBroadcastRef = useRef(0)
  const typingChRef = useRef<RealtimeChannel | null>(null)
  const chRef = useRef<RealtimeChannel | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('channels').select('*').eq('id', channelId).single()
      return data as Channel
    },
  })

  const { data: membership, isLoading: memberCheckLoading } = useQuery({
    queryKey: ['channel-membership', channelId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channel_members')
        .select('channel_id, role')
        .eq('channel_id', channelId)
        .eq('user_id', user!.id)
        .maybeSingle()
      return data
    },
  })

  const isMember = !!membership
  const isChannelAdmin = !!user && !!channel && (channel.created_by === user.id || membership?.role === 'admin')

  const { data: pendingJoinRequests = [] } = useQuery({
    queryKey: ['channel-pending-join-requests', channelId, user?.id],
    enabled: !!user && isChannelAdmin,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channel_join_requests')
        .select('id, channel_id, user_id, created_at, request_note, user:profiles!user_id(id, full_name, username, avatar_url)')
        .eq('channel_id', channelId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      return (data ?? []) as unknown as ChannelJoinRequest[]
    },
  })

  const { mutate: reviewJoinRequest } = useMutation({
    mutationFn: async ({ requestId, userId, approve }: { requestId: string; userId: string; approve: boolean }) => {
      setReviewingJoinRequestId(requestId)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('review_channel_join_request', {
        p_channel_id: channelId,
        p_user_id: userId,
        p_approve: approve,
      })
      setReviewingJoinRequestId(null)
      if (error) throw error
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Could not review request')
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['channel-pending-join-requests', channelId, user?.id] })
      qc.invalidateQueries({ queryKey: ['channel-members', channelId] })
      toast.success(vars.approve ? 'Join request approved' : 'Join request rejected')
      loadMembers()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to review join request'
      toast.error(msg)
    },
  })

  const { data: memberCount } = useQuery({
    queryKey: ['channel-members', channelId],
    queryFn: async () => {
      const supabase = createClient()
      const { count } = await supabase.from('channel_members').select('*', { count: 'exact', head: true }).eq('channel_id', channelId)
      return count ?? 0
    },
  })

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`channel-members-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_members', filter: `channel_id=eq.${channelId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['channel-members', channelId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [channelId, qc])

  // Mark channel as read on mount
  useEffect(() => {
    setChannelUnread(channelId, 0)
  }, [channelId, setChannelUnread])

  // Load reactions for message IDs
  async function loadReactions(messageIds: string[]) {
    if (!messageIds.length || !user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', messageIds)
    if (!data) return
    const map: Record<string, Reaction[]> = {}
    for (const r of data) {
      if (!map[r.message_id]) map[r.message_id] = []
      const ex = map[r.message_id].find((x) => x.emoji === r.emoji)
      if (ex) {
        ex.count++
        if (r.user_id === user.id) ex.byMe = true
      } else {
        map[r.message_id].push({ emoji: r.emoji, count: 1, byMe: r.user_id === user.id })
      }
    }
    setReactions((prev) => ({ ...prev, ...map }))
  }

  // Load initial messages + realtime subscription
  useEffect(() => {
    if (!user || memberCheckLoading) return
    if (!isMember) {
      setMessages([])
      return
    }
    const supabase = createClient()

    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const msgs = data as unknown as MessageWithSender[]
          setMessages(msgs)
          setHasMore(data.length === 50)
          loadReactions(msgs.map((m) => m.id))
          markChannelSeen(msgs.map((m) => m.id))
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
      })

    const ch = supabase
      .channel(`channel-${channelId}`)
      // ── Broadcast: instant delivery to all channel members ────────────────
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const msg = payload.payload as MessageWithSender
        if (!msg?.id) return
        setMessages((prev) =>
          prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]
        )
        if (msg.sender_id !== user?.id) {
          markChannelSeen([msg.id])
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      // ── postgres_changes: fallback for multi-device / future-proofing ───────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data: msg } = await supabase
            .from('messages')
            .select('*, sender:profiles!sender_id(*)')
            .eq('id', payload.new.id)
            .single()
          if (msg) {
            setMessages((prev) =>
              prev.find((m) => m.id === (msg as { id: string }).id)
                ? prev
                : [...prev, msg as unknown as MessageWithSender]
            )
            if ((msg as { sender_id?: string }).sender_id !== user?.id) {
              markChannelSeen([(msg as { id: string }).id])
            }
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const u = payload.new as { id: string; content: string; edited_at: string | null }
          setMessages((prev) =>
            prev.map((m) => m.id === u.id ? { ...m, content: u.content, edited_at: u.edited_at ?? null } : m),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          const id = (payload.old as { id: string }).id
          setMessages((prev) => prev.filter((m) => m.id !== id))
          setReactions((prev) => { const { [id]: _, ...rest } = prev; return rest })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const msgId =
            (payload.new as { message_id?: string } | undefined)?.message_id ??
            (payload.old as { message_id?: string } | undefined)?.message_id
          if (!msgId) return
          setMessages((prev) => {
            if (prev.find((m) => m.id === msgId)) loadReactions([msgId])
            return prev
          })
        },
      )
      .subscribe()
    chRef.current = ch
    const typingCh = supabase
      .channel(`typing-ch-${channelId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId: typingId, name } = payload.payload ?? {}
        if (!typingId || typingId === user.id) return
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]))
        if (typingTimeoutsRef.current[typingId]) clearTimeout(typingTimeoutsRef.current[typingId])
        typingTimeoutsRef.current[typingId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== name))
          delete typingTimeoutsRef.current[typingId]
        }, 3000)
      })
      .subscribe()
    typingChRef.current = typingCh

    return () => {
      supabase.removeChannel(ch)
      supabase.removeChannel(typingCh)
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user, isMember, memberCheckLoading])

  // Scroll-to-bottom button
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150)
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  async function loadOlderMessages() {
    if (!messages.length || loadingOlder) return
    setLoadingOlder(true)
    const oldest = messages[0].created_at
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('channel_id', channelId)
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoadingOlder(false)
    if (!data || data.length === 0) { setHasMore(false); return }
    const older = [...data].reverse() as unknown as MessageWithSender[]
    const container = scrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    setMessages((prev) => [...older, ...prev])
    setHasMore(data.length === 50)
    loadReactions(older.map((m) => m.id))
    markChannelSeen(older.map((m) => m.id))
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevHeight
    })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if ((!text.trim() && !mediaFile) || !user || !isMember || sending || uploading) return
    setSending(true)

    let mediaUrl: string | null = null
    if (mediaFile) {
      setUploading(true)
      const supabase = createClient()
      const ext = mediaFile.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('chat-media').upload(path, mediaFile)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path)
        mediaUrl = publicUrl
      }
      setUploading(false)
      setMediaFile(null)
      setMediaPreview(null)
    }

    const supabase = createClient()
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ channel_id: channelId, sender_id: user.id, content: text.trim() || ' ', media_url: mediaUrl })
      .select('*, sender:profiles!sender_id(*)')
      .single()
    setText('')
    setSending(false)
    if (inserted) {
      const msg = inserted as unknown as MessageWithSender
      // Optimistic: sender sees immediately
      setMessages((prev) =>
        prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      // Broadcast to all channel members for instant delivery
      chRef.current?.send({ type: 'broadcast', event: 'new_message', payload: msg })
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(null)
    }
    e.target.value = ''
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const now = Date.now()
    if (now - lastTypeBroadcastRef.current > 2000 && typingChRef.current) {
      lastTypeBroadcastRef.current = now
      typingChRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user?.id, name: user?.full_name?.split(' ')[0] ?? 'Someone' },
      })
    }
  }

  async function startEdit(msg: MessageWithSender) {
    if (!user) return
    const supabase = createClient()
    const { data, error } = await supabase.rpc('check_can_edit_message', {
      p_message_id: msg.id,
      p_user_id: user.id,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    const result = data as { ok: boolean; error?: string }
    if (!result?.ok) {
      toast.error(result?.error ?? 'Cannot edit this message')
      return
    }
    setEditingId(msg.id)
    setEditText(msg.content)
  }

  async function markChannelSeen(messageIds?: string[]) {
    if (!user) return
    const supabase = createClient()
    const { error } = await supabase.rpc('mark_channel_messages_viewed', { p_channel_id: channelId })
    if (!error) return

    const missingRpc =
      error.code === 'PGRST202' ||
      /could not find the function|not found/i.test(error.message ?? '')
    if (!missingRpc) {
      console.error('Failed to mark channel messages viewed:', error)
      return
    }

    const ids = (messageIds ?? messages.map((m) => m.id)).filter(Boolean)
    if (!ids.length) return
    const uniqueIds = Array.from(new Set(ids))
    const payload = uniqueIds.map((id) => ({ message_id: id, viewer_id: user.id }))
    const { error: fallbackError } = await (supabase
      .from('message_views' as never)
      .upsert(payload as never, { onConflict: 'message_id,viewer_id', ignoreDuplicates: true }))
    if (fallbackError) {
      console.error('Fallback mark seen failed:', fallbackError)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editText.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase.rpc('update_message', {
      p_message_id: editingId,
      p_new_content: editText.trim(),
    })
    if (error) {
      toast.error(error.message)
      return
    }
    const result = data as { ok: boolean; error?: string }
    if (!result?.ok) {
      toast.error(result?.error ?? 'Cannot edit this message')
      return
    }
    setEditingId(null)
    setEditText('')
  }

  async function deleteMessage(id: string) {
    const ok = await confirm({ title: 'Delete message', message: 'This will permanently delete the message for everyone in the channel.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    const supabase = createClient()
    await supabase.from('messages').delete().eq('id', id)
  }

  async function loadMembers() {
    if (!channel) return
    const supabase = createClient()
    const { data: memberRows } = await supabase
      .from('channel_members')
      .select('user_id, role')
      .eq('channel_id', channelId)
      .limit(200)
    if (!memberRows?.length) return
    const ids = memberRows.map((r) => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, username')
      .in('id', ids)
    if (profiles) {
      const roleMap = new Map(memberRows.map((r) => [r.user_id, r.role]))
      setMembers((profiles as { id: string; full_name: string; avatar_url: string | null; username: string }[])
        .map((p) => ({
          ...p,
          role: (roleMap.get(p.id) ?? 'member') as ChannelMemberRole,
          isOwner: p.id === channel.created_by,
        }))
        .sort((a, b) => {
          if (a.isOwner) return -1
          if (b.isOwner) return 1
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (a.role !== 'admin' && b.role === 'admin') return 1
          return a.full_name.localeCompare(b.full_name)
        }))
    }
  }

  async function leaveChannel() {
    if (!user) return
    const ok = await confirm({ title: 'Leave channel', message: `Leave #${channel?.name ?? 'this channel'}? You can rejoin at any time.`, confirmLabel: 'Leave', variant: 'danger' })
    if (!ok) return
    const supabase = createClient()
    const { data, error } = await supabase.rpc('remove_channel_member', {
      p_channel_id: channelId,
      p_user_id: user.id,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    const result = data as { ok: boolean; error?: string }
    if (!result.ok) {
      toast.error(result.error ?? 'Could not leave channel')
      return
    }
    qc.invalidateQueries({ queryKey: ['channel-membership', channelId, user.id] })
    qc.invalidateQueries({ queryKey: ['channel-members', channelId] })
    window.location.href = '/chat'
  }

  async function saveChannelDetails() {
    if (!isChannelAdmin) return
    setSavingChannelDetails(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('update_channel_details', {
      p_channel_id: channelId,
      p_name: channelNameDraft,
      p_description: channelDescriptionDraft,
      p_avatar_url: channelAvatarDraft,
      p_emoji_icon: channelEmojiDraft,
      p_color_hex: channelColorDraft,
      p_banner_url: channel?.banner_url ?? null,
    })
    setSavingChannelDetails(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const result = data as { ok: boolean; error?: string }
    if (!result.ok) {
      toast.error(result.error ?? 'Could not update channel')
      return
    }
    toast.success('Channel details updated')
    qc.invalidateQueries({ queryKey: ['channel', channelId] })
    qc.invalidateQueries({ queryKey: ['channels'] })
    loadMembers()
  }

  async function setMemberRole(member: ChannelMemberInfo, role: 'admin' | 'member') {
    const actionLabel = role === 'admin' ? 'promote to admin' : 'change to member'
    const ok = await confirm({
      title: 'Confirm role change',
      message: `Are you sure you want to ${actionLabel} ${member.full_name}?`,
      confirmLabel: role === 'admin' ? 'Promote' : 'Demote',
      variant: 'danger',
    })
    if (!ok) return

    setManagingMemberId(member.id)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('set_channel_member_role', {
      p_channel_id: channelId,
      p_user_id: member.id,
      p_role: role,
    })
    setManagingMemberId(null)
    if (error) { toast.error(error.message); return }
    const result = data as { ok: boolean; error?: string }
    if (!result.ok) { toast.error(result.error ?? 'Could not update role'); return }
    toast.success(role === 'admin' ? `${member.full_name} is now an admin` : `${member.full_name} is now a member`)
    loadMembers()
  }

  async function removeMember(member: ChannelMemberInfo) {
    const ok = await confirm({
      title: 'Remove member',
      message: `Remove ${member.full_name} from #${channel?.name ?? 'this channel'}?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return

    setManagingMemberId(member.id)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('remove_channel_member', {
      p_channel_id: channelId,
      p_user_id: member.id,
    })
    setManagingMemberId(null)
    if (error) { toast.error(error.message); return }
    const result = data as { ok: boolean; error?: string }
    if (!result.ok) { toast.error(result.error ?? 'Could not remove member'); return }
    toast.success(`${member.full_name} removed`)
    qc.invalidateQueries({ queryKey: ['channel-members', channelId] })
    loadMembers()
  }

  function toggleMute() {
    setMutedChannels((prev) => {
      const next = prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
      localStorage.setItem('mutedChannels', JSON.stringify(next))
      return next
    })
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!user) return
    const supabase = createClient()
    const ex = (reactions[messageId] ?? []).find((r) => r.emoji === emoji)
    if (ex?.byMe) {
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji })
    }
    setPickerFor(null)
  }

  const isMuted = mutedChannels.includes(channelId)
  const themeColor = channel?.color_hex ?? '#7c3aed'
  const panelBg = hexToRgba(themeColor, 0.06)
  const panelBorder = hexToRgba(themeColor, 0.2)
  const accentSoft = hexToRgba(themeColor, 0.18)
  const incomingBubbleBg = hexToRgba(themeColor, 0.12)
  const incomingBubbleBorder = hexToRgba(themeColor, 0.22)
  const mobileActionMessage = mobileActionFor ? messages.find((m) => m.id === mobileActionFor) ?? null : null
  const messageTextStyle: React.CSSProperties = {
    fontFamily:
      chatStyle.fontFamily === 'default'
        ? undefined
        : chatStyle.fontFamily === 'serif'
          ? 'Georgia, ui-serif, serif'
          : 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: `${chatStyle.fontSize}px`,
    fontWeight: Number(chatStyle.fontWeight),
    color: chatStyle.textColor,
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(`channel-chat-style-${channelId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ChatStylePrefs>
      setChatStyle((prev) => ({ ...prev, ...parsed }))
    } catch {
      // ignore corrupt local preference blobs
    }
  }, [channelId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`channel-chat-style-${channelId}`, JSON.stringify(chatStyle))
  }, [channelId, chatStyle])

  function startLongPress(messageId: string) {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: none)').matches) return
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => setMobileActionFor(messageId), 420)
  }

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  if (memberCheckLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading channel…</div>
    )
  }

  if (!isMember) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">Private access required</p>
          <p className="text-sm text-slate-500 mt-2">
            You are not a member of #{channel?.name ?? 'this channel'}. Join from the channel list using entry code or request approval.
          </p>
          <Link
            href="/chat"
            className="inline-flex mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
          >
            Back to channels
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-0 h-full flex-col overflow-hidden"
      onClick={() => { setPickerFor(null); setMobileActionFor(null) }}
      style={{ backgroundColor: panelBg }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b dark:border-slate-800 shrink-0 backdrop-blur"
        style={{
          background: channel?.banner_url
            ? `linear-gradient(to right, ${hexToRgba(themeColor, 0.92)}, ${hexToRgba(themeColor, 0.68)}), url(${channel.banner_url}) center/cover`
            : `linear-gradient(to right, ${hexToRgba(themeColor, 0.2)}, ${hexToRgba(themeColor, 0.08)})`,
          borderColor: panelBorder,
        }}
      >
        <Link href="/chat" className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
        </Link>
        <ChannelAvatar
          name={channel?.name ?? 'channel'}
          avatar_url={channel?.avatar_url}
          emoji_icon={channel?.emoji_icon}
          color_hex={channel?.color_hex ?? '#7c3aed'}
          type={channel?.type}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{channel?.name}</p>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200">
            {channel?.description && <span className="truncate">{channel.description}</span>}
            {memberCount !== undefined && (
              <span className="flex items-center gap-0.5 shrink-0"><Users size={10} /> {memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setChannelNameDraft(channel?.name ?? '')
            setChannelDescriptionDraft(channel?.description ?? '')
            setChannelAvatarDraft(channel?.avatar_url ?? null)
            setChannelEmojiDraft(channel?.emoji_icon ?? null)
            setChannelColorDraft(channel?.color_hex ?? '#7c3aed')
            setShowSettings(true)
            loadMembers()
          }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
          title="Channel settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <>
          <MobileSlideOver open={showSettings} onClose={() => setShowSettings(false)} title="Channel settings">
            <div className="h-full bg-white dark:bg-slate-900 flex flex-col overflow-y-auto shadow-xl">
            {/* Panel header */}
            {/* Channel info */}
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="mb-3">
                <ChannelAvatar
                  name={channelNameDraft || channel?.name || 'channel'}
                  avatar_url={channelAvatarDraft}
                  emoji_icon={channelEmojiDraft}
                  color_hex={channelColorDraft}
                  type={channel?.type}
                  size="lg"
                />
              </div>
              {isChannelAdmin ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Channel name</label>
                    <input
                      value={channelNameDraft}
                      onChange={(e) => setChannelNameDraft(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Description</label>
                    <textarea
                      value={channelDescriptionDraft}
                      onChange={(e) => setChannelDescriptionDraft(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <ChannelAvatarEditor
                    channelId={channelId}
                    channelName={channelNameDraft || channel?.name || 'channel'}
                    currentAvatar={channelAvatarDraft}
                    currentEmoji={channelEmojiDraft}
                    currentColor={channelColorDraft}
                    isAdmin={isChannelAdmin}
                    onUpdate={async ({ avatar_url, emoji_icon, color_hex }) => {
                      if (avatar_url !== undefined) setChannelAvatarDraft(avatar_url)
                      if (emoji_icon !== undefined) setChannelEmojiDraft(emoji_icon)
                      if (color_hex !== undefined) setChannelColorDraft(color_hex)
                    }}
                  />
                  <button
                    onClick={saveChannelDetails}
                    disabled={savingChannelDetails}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60"
                  >
                    {savingChannelDetails ? 'Saving…' : 'Save details'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-slate-900 dark:text-white">{channel?.name}</p>
                  {channel?.description && (
                    <p className="text-xs text-slate-400 mt-1">{channel.description}</p>
                  )}
                </>
              )}
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Users size={11} /> {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>

            {/* Members list */}
            {isChannelAdmin && (
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pending join requests</p>
                {pendingJoinRequests.length === 0 ? (
                  <p className="text-xs text-slate-400">No pending requests.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingJoinRequests.map((r) => (
                      <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={r.user.avatar_url} name={r.user.full_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{r.user.full_name}</p>
                            <p className="text-[11px] text-slate-400 truncate">@{r.user.username}</p>
                          </div>
                        </div>
                        {r.request_note && (
                          <p className="text-[11px] text-slate-500 mt-1">{r.request_note}</p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            disabled={reviewingJoinRequestId === r.id}
                            onClick={() => reviewJoinRequest({ requestId: r.id, userId: r.user_id, approve: true })}
                            className="text-[10px] px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          >
                            Approve
                          </button>
                          <button
                            disabled={reviewingJoinRequestId === r.id}
                            onClick={() => reviewJoinRequest({ requestId: r.id, userId: r.user_id, approve: false })}
                            className="text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Members</p>
              {members.length === 0 ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Avatar src={m.avatar_url} name={m.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          {m.full_name}{m.id === user?.id ? ' (you)' : ''}
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full capitalize border',
                              m.isOwner
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : m.role === 'admin'
                                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                            )}
                          >
                            {m.isOwner ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Member'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          @{m.username} · {m.isOwner ? 'owner' : m.role}
                        </p>
                      </div>
                      {isChannelAdmin && !m.isOwner && m.id !== user?.id && (
                        <div className="flex items-center gap-1">
                          <button
                            disabled={managingMemberId === m.id}
                            onClick={() => setMemberRole(m, m.role === 'admin' ? 'member' : 'admin')}
                            className="text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {m.role === 'admin' ? 'Make member' : 'Make admin'}
                          </button>
                          <button
                            disabled={managingMemberId === m.id}
                            onClick={() => removeMember(m)}
                            className="text-[10px] px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 space-y-1">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2.5 mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chat appearance</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-slate-500">
                    Font
                    <select
                      value={chatStyle.fontFamily}
                      onChange={(e) => setChatStyle((p) => ({ ...p, fontFamily: e.target.value as ChatStylePrefs['fontFamily'] }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="default">Default</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-500">
                    Size
                    <select
                      value={chatStyle.fontSize}
                      onChange={(e) => setChatStyle((p) => ({ ...p, fontSize: e.target.value as ChatStylePrefs['fontSize'] }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="13">Small</option>
                      <option value="14">Medium</option>
                      <option value="16">Large</option>
                      <option value="18">XL</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-500">
                    Weight
                    <select
                      value={chatStyle.fontWeight}
                      onChange={(e) => setChatStyle((p) => ({ ...p, fontWeight: e.target.value as ChatStylePrefs['fontWeight'] }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="600">Semibold</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-500">
                    Color
                    <input
                      type="color"
                      value={chatStyle.textColor}
                      onChange={(e) => setChatStyle((p) => ({ ...p, textColor: e.target.value }))}
                      className="mt-1 h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1"
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={toggleMute}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                {isMuted ? <Bell size={15} className="text-violet-500" /> : <BellOff size={15} className="text-slate-400" />}
                {isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </button>
              <button
                onClick={leaveChannel}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
              >
                <LogOut size={15} />
                Leave channel
              </button>
            </div>
            </div>
          </MobileSlideOver>
        </>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-1 pb-[env(safe-area-inset-bottom)] md:pb-3"
        style={{ backgroundColor: channel?.banner_url ? hexToRgba(themeColor, 0.04) : undefined }}
      >
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-xs text-violet-500 hover:text-violet-400 font-medium disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <MessageCircle size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">Be the first to say something in #{channel?.name}!</p>
          </div>
        )}

        {messages
          .filter((m) => !(m.deleted_for_sender && m.sender_id === user?.id))
          .map((msg, i) => {
          const isOwn = msg.sender_id === user?.id
          const prevMsg = messages[i - 1]
          const showDateSep = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
          const grouped =
            prevMsg && !showDateSep &&
            prevMsg.sender_id === msg.sender_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000
          const msgReactions = reactions[msg.id] ?? []

          return (
            <React.Fragment key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-2 py-3 my-1">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[11px] text-slate-400 font-medium px-2 whitespace-nowrap">{formatDay(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              <div
                className={cn('group flex items-end gap-1', isOwn && 'flex-row-reverse', grouped && 'mt-0.5')}
              >
              {/* Avatar */}
              {!grouped ? (
                <UserProfileModal userId={msg.sender_id} username={msg.sender.username}>
                  <EnhancedAvatar
                    src={msg.sender.avatar_url}
                    name={msg.sender.full_name}
                    size="sm"
                    frame={(msg.sender.avatar_frame ?? 'classic') as any}
                    className="mb-0.5 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                  />
                </UserProfileModal>
              ) : (
                <div className="w-7 shrink-0" />
              )}

              <div className={cn('max-w-[88%] sm:max-w-[72%] lg:max-w-[66%]', isOwn && 'items-end flex flex-col')}>
                {!grouped && (
                  <p className="text-xs text-slate-400 mb-1 px-1">
                    {isOwn ? 'You' : msg.sender.full_name}
                  </p>
                )}

                {editingId === msg.id ? (
                  <form onSubmit={saveEdit} className="w-full min-w-[220px]">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-800 dark:text-slate-200"
                      style={messageTextStyle}
                      rows={2}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Escape') { setEditingId(null); setEditText('') } }}
                    />
                    <div className="flex gap-2 mt-1 justify-end">
                      <button type="button" onClick={() => { setEditingId(null); setEditText('') }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                      <button type="submit" className="text-xs text-violet-600 hover:text-violet-500 font-medium">Save</button>
                    </div>
                  </form>
                ) : (
                  <div
                    className={cn(
                      'rounded-2xl text-sm inline-block',
                      isOwn
                        ? 'text-white rounded-tr-sm'
                        : 'text-slate-800 dark:text-slate-100 rounded-tl-sm border',
                    )}
                    style={isOwn
                      ? { backgroundColor: themeColor }
                      : { backgroundColor: incomingBubbleBg, borderColor: incomingBubbleBorder }}
                    onTouchStart={() => startLongPress(msg.id)}
                    onTouchEnd={clearLongPress}
                    onTouchMove={clearLongPress}
                    onTouchCancel={clearLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMobileActionFor(msg.id)
                    }}
                  >
                    {msg.media_url && (
                      <div className="p-2 pb-0">
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.media_url) ? (
                          <img
                            src={msg.media_url}
                            alt="attachment"
                            className="max-w-full rounded-xl cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); window.open(msg.media_url!) }}
                          />
                        ) : (
                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={cn('flex items-center gap-1.5 text-xs underline py-1 px-1', isOwn ? 'text-violet-200' : 'text-slate-700 dark:text-slate-200')}>
                            <Paperclip size={11} /> Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content.trim() && (
                      <p className="px-3 pt-2 pb-1 whitespace-pre-wrap break-words" style={messageTextStyle}>{msg.content}</p>
                    )}
                    {/* Time row inside bubble */}
                    <div className={cn(
                      'flex items-center gap-1 px-2.5 pb-1.5 pt-0',
                      isOwn ? 'justify-end' : 'justify-start',
                    )}>
                      {msg.edited_at && <span className="text-[9px] italic opacity-70">(edited)</span>}
                      <span className={cn(
                        'text-[10px] opacity-70 leading-none',
                        isOwn ? 'text-violet-200' : 'text-slate-500 dark:text-slate-300',
                      )}>{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                )}

                {/* Reaction bubbles */}
                {msgReactions.length > 0 && (
                  <div className={cn('flex flex-wrap gap-1 mt-1', isOwn && 'justify-end')}>
                    {msgReactions.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, r.emoji) }}
                        className={cn(
                          'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                          r.byMe
                            ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-400 text-violet-700 dark:text-violet-300'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-300',
                        )}
                      >
                        {r.emoji}{r.count > 1 ? ` ${r.count}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover actions */}
              <div className={cn(
                'hidden md:flex items-center gap-1 transition-opacity mb-1 shrink-0 opacity-0 group-hover:opacity-100',
                isOwn && 'order-first flex-row-reverse',
              )}>
                {/* Emoji picker */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === msg.id ? null : msg.id) }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300"
                  >
                    <Smile size={14} />
                  </button>
                  {pickerFor === msg.id && (
                    <div className={cn(
                      'absolute bottom-8 z-20 bg-white dark:bg-slate-800 shadow-lg rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 flex gap-0.5',
                      isOwn ? 'right-0' : 'left-0',
                    )}>
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji) }}
                          className="w-8 h-8 flex items-center justify-center text-base hover:scale-125 transition-transform rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit / delete (own only) */}
                {isOwn && editingId !== msg.id && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); void startEdit(msg) }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 dark:text-slate-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
                {/* Copy */}
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content) }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300"
                  title="Copy message"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
            </React.Fragment>
          )
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-end gap-2 px-2 py-1">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3 py-2.5">
              <p className="text-xs text-slate-400 mb-1">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
              </p>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {showScrollBtn && (
          <div className="sticky bottom-4 flex justify-end pr-2 pointer-events-none">
            <button
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="pointer-events-auto w-9 h-9 rounded-full bg-violet-600 shadow-lg flex items-center justify-center text-white hover:bg-violet-500 transition"
              title="Jump to latest"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {mobileActionMessage && (
        <div className="fixed inset-x-3 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-40 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="text-[11px] font-medium text-slate-500">Message actions</p>
              <button
                onClick={() => setMobileActionFor(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { void toggleReaction(mobileActionMessage.id, emoji); setMobileActionFor(null) }}
                  className="h-9 w-9 rounded-lg bg-slate-100 text-base dark:bg-slate-800"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => { navigator.clipboard.writeText(mobileActionMessage.content); setMobileActionFor(null) }}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Copy size={12} /> Copy
              </button>
              {mobileActionMessage.sender_id === user?.id && (
                <button
                  onClick={() => { void startEdit(mobileActionMessage); setMobileActionFor(null) }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {mobileActionMessage.sender_id === user?.id && (
                <button
                  onClick={() => { void deleteMessage(mobileActionMessage.id); setMobileActionFor(null) }}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-300"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File preview */}
      {(mediaPreview || mediaFile) && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          {mediaPreview ? (
            <div className="relative inline-block">
              <img src={mediaPreview} alt="" className="h-16 rounded-lg object-cover" />
              <button
                onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-slate-400 shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{mediaFile!.name}</span>
              <button onClick={() => setMediaFile(null)} className="ml-auto text-red-400 hover:text-red-500 shrink-0">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form
        ref={formRef}
        onSubmit={sendMessage}
        className="flex items-end gap-2 px-2.5 sm:px-4 lg:px-6 py-2 border-t dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shrink-0 backdrop-blur"
        style={{ borderColor: panelBorder, backgroundColor: hexToRgba(themeColor, 0.05) }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-violet-500 transition shrink-0 mb-0.5"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          value={text}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); formRef.current?.requestSubmit() }
          }}
          rows={1}
          placeholder="Type a message…"
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none resize-none max-h-32 overflow-y-auto"
          style={{ ...messageTextStyle, boxShadow: `0 0 0 0 ${accentSoft}` }}
        />
        <button
          type="submit"
          disabled={(!text.trim() && !mediaFile) || sending || uploading}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl disabled:opacity-40 flex items-center justify-center transition shrink-0 mb-0.5"
          style={{ backgroundColor: themeColor }}
        >
          {(sending || uploading) ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={16} className="text-white" />}
        </button>
      </form>
    </div>
  )
}
