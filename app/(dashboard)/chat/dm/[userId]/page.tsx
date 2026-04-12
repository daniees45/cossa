'use client'
import React, { useEffect, useRef, useState, useCallback, use } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { EnhancedAvatar } from '@/components/shared/EnhancedAvatar'
import { UserProfileModal } from '@/components/shared/UserProfileModal'
import { toast } from 'sonner'
import {
  Send, ArrowLeft, Lock, LockOpen, Paperclip, Smile,
  Pencil, Trash2, CheckCheck, X, Copy, ChevronDown, MessageCircle, Settings, Bell, BellOff,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { MessageWithSender, Profile } from '@/types/app'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { useChatStore } from '@/lib/stores/chatStore'
import { useDialog } from '@/components/shared/DialogProvider'
import { Spinner } from '@/components/shared/Spinner'
import { MobileSlideOver } from '@/components/shared/MobileSlideOver'
import {
  ensureKeyPair,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from '@/lib/crypto/dm'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']
type VisibleMsg = { id: string; content: string; encrypted: boolean }
type Reaction = { emoji: string; count: number; byMe: boolean }

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

export default function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user } = useUser()
  const qc = useQueryClient()
  const { clearDmUnread } = useChatStore()
  const { confirm } = useDialog()

  const [showSettings, setShowSettings] = useState(false)
  const [mutedDms, setMutedDms] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('mutedDms') ?? '[]') } catch { return [] }
  })

  // ── Core state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [visible, setVisible] = useState<VisibleMsg[]>([])
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  // ── Input state ──────────────────────────────────────────────────────────
  const [text, setText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)

  // ── E2EE ────────────────────────────────────────────────────────────────
  const [e2eActive, setE2eActive] = useState(false)
  const myPrivRef = useRef<CryptoKey | null>(null)
  const theirPubRef = useRef<CryptoKey | null>(null)

  // ── Edit/delete ──────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // ── Reactions ────────────────────────────────────────────────────────────
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // ── Typing indicator ─────────────────────────────────────────────────────
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypeBroadcastRef = useRef(0)
  const typingChRef = useRef<RealtimeChannel | null>(null)
  const dmChannelRef = useRef<RealtimeChannel | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [otherOnline, setOtherOnline] = useState(false)
  const [mobileActionFor, setMobileActionFor] = useState<string | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [chatStyle, setChatStyle] = useState<ChatStylePrefs>({
    fontFamily: 'default',
    fontSize: '14',
    fontWeight: '400',
    textColor: '#111827',
  })

  // ── Scroll refs ──────────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: other } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      return data as Profile
    },
  })

  // ── E2EE setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !other) return
    const currentUser = user
    const otherUser = other
    let cancelled = false
    async function initE2EE() {
      const supabase = createClient()
      try {
        const { data: me } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('id', currentUser.id)
          .single()

        const { data: encryptedPrivateKeyBlob } = await supabase.rpc('get_encrypted_private_key')

        const { myPrivate, theirPublic, newPublicKeyB64, newEncryptedPrivateKeyBlob } = await ensureKeyPair(
          currentUser.id,
          otherUser.public_key ?? null,
          me?.public_key ?? null,
          (encryptedPrivateKeyBlob as string | null) ?? null,
        )

        if (cancelled) return

        myPrivRef.current = myPrivate
        theirPubRef.current = theirPublic
        if (newPublicKeyB64) {
          await supabase.from('profiles').update({ public_key: newPublicKeyB64 }).eq('id', currentUser.id)
        }
        if (newEncryptedPrivateKeyBlob) {
          await supabase.rpc('set_encrypted_private_key', { p_blob: newEncryptedPrivateKeyBlob })
        }
        setE2eActive(!!theirPublic)
      } catch (error) {
        console.error('Failed to initialize E2EE keys:', error)
        if (!cancelled) setE2eActive(false)
      }
    }

    initE2EE()
    return () => { cancelled = true }
  }, [user, other])

  // ── Decrypt whenever messages change ────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function decrypt() {
      const myPriv = myPrivRef.current
      const theirPub = theirPubRef.current
      const result: VisibleMsg[] = await Promise.all(
        messages.map(async (msg) => {
          if (isEncrypted(msg.content)) {
            if (!myPriv || !theirPub) {
              console.warn('E2EE keys not available, message will show as encrypted')
              return { id: msg.id, content: '🔒 Encrypted (keys loading...)', encrypted: true }
            }
            try {
              const decrypted = await decryptMessage(myPriv, theirPub, msg.content)
              return { id: msg.id, content: decrypted, encrypted: true }
            } catch (error) {
              console.error(`Failed to decrypt message ${msg.id}:`, error)
              const isOperationError =
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                String((error as { name?: string }).name) === 'OperationError'
              return {
                id: msg.id,
                content: isOperationError
                  ? '🔒 Unable to decrypt (key mismatch)'
                  : '🔒 Unable to decrypt',
                encrypted: true,
              }
            }
          }
          return { id: msg.id, content: msg.content, encrypted: false }
        }),
      )
      if (!cancelled) setVisible(result)
    }
    decrypt()
    return () => { cancelled = true }
  }, [messages, e2eActive])

  // ── Load reactions for a set of message IDs ──────────────────────────────
  const loadReactions = useCallback(async (messageIds: string[]) => {
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
  }, [user])

  // ── Load history + subscribe ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),` +
        `and(sender_id.eq.${userId},receiver_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const msgs = data as unknown as MessageWithSender[]
          setMessages(msgs)
          setHasMore(data.length === 50)
          loadReactions(msgs.map((m) => m.id))
        }
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })

    // Mark incoming messages as read
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', userId)
      .eq('receiver_id', user.id)
      .is('read_at', null)
      .then(() => {
        clearDmUnread(userId)
        qc.invalidateQueries({ queryKey: ['dm-unread'] })
      })

    // Realtime subscriptions
    // We subscribe to both directions of the conversation so BOTH sender and
    // receiver see messages the instant they are inserted.
    async function handleNewDmMessage(payload: { new: Record<string, unknown> }) {
      if (!user) return
      const row = payload.new as { id: string; sender_id: string; receiver_id: string }
      // Only care about messages in THIS conversation
      const inConversation =
        (row.sender_id === user.id && row.receiver_id === userId) ||
        (row.sender_id === userId && row.receiver_id === user.id)
      if (!inConversation) return

      const { data: msg } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*)')
        .eq('id', row.id)
        .single()
      if (!msg) return

      setMessages((prev) =>
        prev.find((m) => m.id === row.id)
          ? prev
          : [...prev, msg as unknown as MessageWithSender]
      )
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

      // If we are the receiver, mark as read immediately
      if (row.receiver_id === user.id) {
        await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id)
      }
    }

    const dmChannel = supabase
      .channel(`dm-${[user.id, userId].sort().join('-')}`)
      // ── Broadcast: instant delivery without postgres_changes publication ────
      .on('broadcast', { event: 'new_message' }, async (payload) => {
        const row = payload.payload as MessageWithSender & { sender: Profile }
        if (!row?.id) return
        setMessages((prev) =>
          prev.find((m) => m.id === row.id)
            ? prev
            : [...prev, row]
        )
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        // Mark as read if we are the receiver
        if (row.receiver_id === user?.id) {
          const sb = createClient()
          await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', row.id)
        }
      })
      // ── postgres_changes: fallback for multi-device / missed broadcasts ────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        handleNewDmMessage,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        handleNewDmMessage,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const u = payload.new as { id: string; content: string; edited_at: string | null; read_at: string | null; deleted_for_sender: boolean; sender_id: string }
          // If sender marked this deleted for themselves, remove from their state
          if (u.deleted_for_sender && u.sender_id === user.id) {
            setMessages((prev) => prev.filter((m) => m.id !== u.id))
            return
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === u.id
                ? { ...m, content: u.content, edited_at: u.edited_at ?? null, read_at: u.read_at ?? null }
                : m,
            ),
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
      .on('presence', { event: 'sync' }, () => {
        const state = dmChannel.presenceState<{ user_id: string }>()
        setOtherOnline(Object.values(state).flat().some((p) => p.user_id === userId))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await dmChannel.track({ user_id: user.id })
      })
    dmChannelRef.current = dmChannel
    const typingKey = `typing-dm-${[user.id, userId].sort().join('-')}`
    const typingCh = supabase
      .channel(typingKey)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.userId !== userId) return
        setIsTyping(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
      })
      .subscribe()
    typingChRef.current = typingCh

    return () => {
      supabase.removeChannel(dmChannel)
      supabase.removeChannel(typingCh)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [user, userId, loadReactions, clearDmUnread, qc])

  // Scroll-to-bottom button
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150)
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  // ── Load older messages ──────────────────────────────────────────────────
  async function loadOlderMessages() {
    if (!messages.length || loadingOlder || !user) return
    setLoadingOlder(true)
    const oldest = messages[0].created_at
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),` +
        `and(sender_id.eq.${userId},receiver_id.eq.${user.id})`,
      )
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoadingOlder(false)
    if (!data || !data.length) { setHasMore(false); return }
    const older = [...data].reverse() as unknown as MessageWithSender[]
    const container = scrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    setMessages((prev) => [...older, ...prev])
    setHasMore(data.length === 50)
    loadReactions(older.map((m) => m.id))
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevHeight
    })
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if ((!text.trim() && !mediaFile) || !user || uploading || sending) return
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
    let content = text.trim() || ' '
    if (myPrivRef.current && theirPubRef.current && content.trim()) {
      try {
        content = await encryptMessage(myPrivRef.current, theirPubRef.current, content)
      } catch { /* fall back to plaintext */ }
    }
    setText('')
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: userId, content, media_url: mediaUrl })
      .select('*, sender:profiles!sender_id(*)')
      .single()
    if (inserted) {
      const msg = inserted as unknown as MessageWithSender
      // Optimistic: sender sees immediately
      setMessages((prev) =>
        prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      // Broadcast to receiver for instant delivery (bypasses realtime publication)
      dmChannelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: msg })
    }
    setSending(false)
  }

  // ── File selection ────────────────────────────────────────────────────────
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

  // ── Typing broadcast ──────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const now = Date.now()
    if (now - lastTypeBroadcastRef.current > 2000 && typingChRef.current) {
      lastTypeBroadcastRef.current = now
      typingChRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id } })
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(msg: MessageWithSender) {
    const decrypted = visibleMap.get(msg.id)?.content ?? msg.content
    setEditingId(msg.id)
    setEditText(decrypted)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editText.trim() || !user) return
    
    const supabase = createClient()
    const original = messages.find((m) => m.id === editingId)
    
    if (!original) {
      setEditingId(null)
      return
    }

    // Check if message is seen (read by recipient)
    if (original.read_at) {
      toast.error('Cannot edit message after recipient has seen it')
      setEditingId(null)
      return
    }

    let content = editText.trim()
    if (isEncrypted(original.content) && myPrivRef.current && theirPubRef.current) {
      try {
        content = await encryptMessage(myPrivRef.current, theirPubRef.current, content)
      } catch {
        console.error('Failed to re-encrypt message')
        toast.error('Failed to encrypt edited message')
        setEditingId(null)
        return
      }
    }

    try {
      await supabase
        .from('messages')
        .update({ content, edited_at: new Date().toISOString() })
        .eq('id', editingId)
        .eq('sender_id', user.id)

      setEditingId(null)
      setEditText('')
      toast.success('Message updated')
    } catch (error) {
      console.error('Failed to update message:', error)
      toast.error('Failed to update message')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteMessage(msg: MessageWithSender) {
    const ok = await confirm({ title: 'Delete message', message: msg.read_at ? 'This will remove the message from your view. The recipient will still see it.' : 'This will permanently delete the message for both sides.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    const supabase = createClient()
    if (msg.read_at) {
      // Already read by receiver → soft-delete (hide from sender only)
      await supabase.from('messages').update({ deleted_for_sender: true }).eq('id', msg.id)
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    } else {
      // Not yet read → hard-delete (removes from both sides)
      await supabase.from('messages').delete().eq('id', msg.id)
    }
  }

  // ── Reaction toggle ───────────────────────────────────────────────────────
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

  function toggleMuteDm() {
    setMutedDms((prev) => {
      const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      localStorage.setItem('mutedDms', JSON.stringify(next))
      return next
    })
  }

  async function clearConversation() {
    const ok = await confirm({ title: 'Clear conversation', message: 'This will hide all your sent messages from this conversation. The other person will not be affected.', confirmLabel: 'Clear', variant: 'danger' })
    if (!ok) return
    const supabase = createClient()
    // Soft-delete all own messages in this DM (show update to others isn't affected)
    supabase
      .from('messages')
      .update({ deleted_for_sender: true })
      .eq('sender_id', user!.id)
      .not('channel_id', 'is', null)
      .then(() => {
        // Also target DM messages (no channel_id)
        supabase
          .from('messages')
          .update({ deleted_for_sender: true })
          .eq('sender_id', user!.id)
          .is('channel_id', null)
          .then(() => {
            setMessages((prev) => prev.filter((m) => m.sender_id !== user?.id))
          })
      })
  }

  const visibleMap = new Map(visible.map((v) => [v.id, v]))
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
      const raw = localStorage.getItem(`dm-chat-style-${userId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<ChatStylePrefs>
      setChatStyle((prev) => ({ ...prev, ...parsed }))
    } catch {
      // ignore invalid settings payload
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`dm-chat-style-${userId}`, JSON.stringify(chatStyle))
  }, [userId, chatStyle])

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

  // "Seen" indicator: last sent message that has been read
  const lastReadMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user?.id && messages[i].read_at) return messages[i].id
    }
    return null
  })()

  const isMutedDm = mutedDms.includes(userId)

  return (
    <div className="flex min-h-0 h-full flex-col overflow-hidden" onClick={() => { setPickerFor(null); setMobileActionFor(null) }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shrink-0 backdrop-blur">
        <Link href="/chat" className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        {other && (
          <>
            <Avatar src={other.avatar_url} name={other.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{other.full_name}</p>
                {otherOnline && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />}
              </div>
              <p className="text-xs text-slate-400">{otherOnline ? 'Online' : `@${other.username}`}</p>
            </div>
            <div
              title={e2eActive ? 'End-to-end encrypted' : 'No encryption'}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-full border',
                e2eActive
                  ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-300 dark:border-slate-700 text-slate-400 bg-slate-50 dark:bg-slate-800',
              )}
            >
              {e2eActive ? <Lock size={11} /> : <LockOpen size={11} />}
              <span className="hidden sm:inline">{e2eActive ? 'Encrypted' : 'Not encrypted'}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettings(true) }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
              title="Conversation settings"
            >
              <Settings size={16} />
            </button>
          </>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <>
          <MobileSlideOver open={showSettings} onClose={() => setShowSettings(false)} title="Conversation info">
            <div className="h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto shadow-xl">
            {/* Panel header */}
            {/* User info */}
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
              <Avatar src={other?.avatar_url ?? null} name={other?.full_name ?? ''} size="lg" className="mb-2" />
              <p className="font-semibold text-slate-900 dark:text-white">{other?.full_name}</p>
              <p className="text-xs text-slate-400">@{other?.username}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', otherOnline ? 'bg-emerald-500' : 'bg-slate-300')} />
                <span className="text-xs text-slate-400">{otherOnline ? 'Online now' : 'Offline'}</span>
              </div>
            </div>

            {/* Encryption */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Encryption</p>
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm',
                e2eActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-500',
              )}>
                {e2eActive ? <Lock size={14} /> : <LockOpen size={14} />}
                {e2eActive ? 'End-to-end encrypted' : 'Not encrypted'}
              </div>
            </div>

            {/* Shared media */}
            {(() => {
              const mediaMessages = messages.filter((m) => m.media_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.media_url))
              return mediaMessages.length > 0 ? (
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Shared media ({mediaMessages.length})</p>
                  <div className="grid grid-cols-3 gap-1">
                    {mediaMessages.slice(-9).map((m) => (
                      <img
                        key={m.id}
                        src={m.media_url!}
                        alt=""
                        className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                        onClick={() => window.open(m.media_url!)}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            })()}

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
                onClick={toggleMuteDm}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                {isMutedDm ? <Bell size={15} className="text-violet-500" /> : <BellOff size={15} className="text-slate-400" />}
                {isMutedDm ? 'Unmute notifications' : 'Mute notifications'}
              </button>
              <button
                onClick={() => { setShowSettings(false); clearConversation() }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
              >
                <Trash2 size={15} />
                Clear conversation
              </button>
            </div>
            </div>
          </MobileSlideOver>
        </>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 sm:px-4 lg:px-6 py-3 sm:py-4 space-y-1 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.05),transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_45%)] pb-0 md:pb-3">
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
            <p className="text-xs text-slate-400 mt-1">Say hi to {other?.full_name ?? 'them'}!</p>
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
          const display = visibleMap.get(msg.id)
          const content = display?.content ?? msg.content
          const wasEncrypted = display?.encrypted ?? false
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

              <div className={cn('max-w-[88%] sm:max-w-[72%] lg:max-w-[66%]', isOwn ? 'items-end flex flex-col' : '')}>
                {!grouped && (
                  <p className="text-xs text-slate-400 mb-1 px-1">
                    {isOwn ? 'You' : msg.sender.full_name}
                  </p>
                )}

                {/* Bubble / edit form */}
                {editingId === msg.id ? (
                  <form onSubmit={saveEdit} className="w-full min-w-0 sm:min-w-[220px]">
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
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm',
                    )}
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
                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className={cn('flex items-center gap-1.5 text-xs underline py-1 px-1', isOwn ? 'text-violet-200' : 'text-slate-500')}>
                            <Paperclip size={11} /> Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {content.trim() && (
                      <p
                        className="px-3 pt-2 pb-1 whitespace-pre-wrap break-words"
                        style={messageTextStyle}
                        onTouchStart={() => startLongPress(msg.id)}
                        onTouchEnd={clearLongPress}
                        onTouchMove={clearLongPress}
                        onTouchCancel={clearLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMobileActionFor(msg.id)
                        }}
                      >
                        {content}
                      </p>
                    )}
                    {/* Time + status row inside bubble */}
                    <div className={cn(
                      'flex items-center gap-1 px-2.5 pb-1.5 pt-0',
                      isOwn ? 'justify-end' : 'justify-start',
                    )}>
                      {wasEncrypted && <Lock size={9} className="text-emerald-300 shrink-0" />}
                      {msg.edited_at && <span className="text-[9px] italic opacity-70">(edited)</span>}
                      <span className={cn(
                        'text-[10px] opacity-70 leading-none',
                        isOwn ? 'text-violet-200' : 'text-slate-400',
                      )}>{formatTime(msg.created_at)}</span>
                      {isOwn && msg.id === lastReadMsgId && (
                        <CheckCheck size={12} className="text-violet-200 shrink-0" />
                      )}
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

              {/* Hover actions: emoji picker + edit/delete */}
              <div className={cn(
                'hidden md:flex items-center gap-1 transition-opacity mb-1 shrink-0 opacity-0 group-hover:opacity-100',
                isOwn && 'order-first flex-row-reverse',
              )}>
                {/* Emoji picker trigger */}
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

                {/* Edit / delete (own messages only) */}
                {isOwn && editingId !== msg.id && (
                  <>
                    {/* Edit: only allowed if receiver has NOT yet read the message */}
                    {!msg.read_at && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(msg) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300"
                        title="Edit message"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {/* Delete: always allowed for sender */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMessage(msg) }}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 dark:text-slate-300"
                      title={msg.read_at ? 'Remove from your view' : 'Delete message'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
                {/* Copy */}
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(content) }}
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
        {isTyping && (
          <div className="flex items-end gap-2 px-2">
            <Avatar src={other?.avatar_url} name={other?.full_name ?? ''} size="sm" className="shrink-0" />
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3 py-2.5">
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
                onClick={() => {
                  const val = visibleMap.get(mobileActionMessage.id)?.content ?? mobileActionMessage.content
                  navigator.clipboard.writeText(val)
                  setMobileActionFor(null)
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Copy size={12} /> Copy
              </button>
              {mobileActionMessage.sender_id === user?.id && !mobileActionMessage.read_at && (
                <button
                  onClick={() => { startEdit(mobileActionMessage); setMobileActionFor(null) }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {mobileActionMessage.sender_id === user?.id && (
                <button
                  onClick={() => { void deleteMessage(mobileActionMessage); setMobileActionFor(null) }}
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
        className="flex items-end gap-2 px-2.5 sm:px-4 lg:px-6 py-1 md:py-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shrink-0 backdrop-blur"
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
          placeholder={e2eActive ? `Message ${other?.full_name ?? ''} (encrypted)…` : `Message ${other?.full_name ?? ''}…`}
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500 resize-none max-h-32 overflow-y-auto"
          style={messageTextStyle}
        />
        <button
          type="submit"
          disabled={(!text.trim() && !mediaFile) || uploading || sending}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition shrink-0 mb-0.5"
        >
          {(sending || uploading) ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={16} className="text-white" />}
        </button>
      </form>
    </div>
  )
}

