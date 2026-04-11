'use client'
import { useEffect, useRef, useState, useCallback, use } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import {
  Send, ArrowLeft, Lock, LockOpen, Paperclip, Smile,
  Pencil, Trash2, CheckCheck, X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { MessageWithSender, Profile } from '@/types/app'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { useChatStore } from '@/lib/stores/chatStore'
import {
  ensureKeyPair,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from '@/lib/crypto/dm'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']
type VisibleMsg = { id: string; content: string; encrypted: boolean }
type Reaction = { emoji: string; count: number; byMe: boolean }

export default function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user } = useUser()
  const qc = useQueryClient()
  const { clearDmUnread } = useChatStore()

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
    ensureKeyPair(user.id, other.public_key ?? null).then(
      async ({ myPrivate, theirPublic, newPublicKeyB64 }) => {
        myPrivRef.current = myPrivate
        theirPubRef.current = theirPublic
        if (newPublicKeyB64) {
          const supabase = createClient()
          await supabase.from('profiles').update({ public_key: newPublicKeyB64 }).eq('id', user.id)
        }
        setE2eActive(!!theirPublic)
      },
    )
  }, [user, other])

  // ── Decrypt whenever messages change ────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function decrypt() {
      const myPriv = myPrivRef.current
      const theirPub = theirPubRef.current
      const result: VisibleMsg[] = await Promise.all(
        messages.map(async (msg) => {
          if (isEncrypted(msg.content) && myPriv && theirPub) {
            try {
              return { id: msg.id, content: await decryptMessage(myPriv, theirPub, msg.content), encrypted: true }
            } catch {
              return { id: msg.id, content: '🔒 Unable to decrypt', encrypted: true }
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
    const dmChannel = supabase
      .channel(`dm-${[user.id, userId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          if (payload.new.sender_id !== userId) return
          const { data: msg } = await supabase
            .from('messages')
            .select('*, sender:profiles!sender_id(*)')
            .eq('id', payload.new.id)
            .single()
          if (msg) {
            setMessages((prev) => [...prev, msg as unknown as MessageWithSender])
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            // Mark as read immediately since we're in the conversation
            await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const u = payload.new as { id: string; content: string; edited_at: string | null; read_at: string | null }
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
      .subscribe()

    // Typing broadcast channel
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
    if ((!text.trim() && !mediaFile) || !user || uploading) return

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
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content,
      media_url: mediaUrl,
    })
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
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    let content = editText.trim()
    const original = messages.find((m) => m.id === editingId)
    if (original && isEncrypted(original.content) && myPrivRef.current && theirPubRef.current) {
      try {
        content = await encryptMessage(myPrivRef.current, theirPubRef.current, content)
      } catch { /* keep plaintext */ }
    }
    await supabase.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', editingId)
    setEditingId(null)
    setEditText('')
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteMessage(id: string) {
    const supabase = createClient()
    await supabase.from('messages').delete().eq('id', id)
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

  const visibleMap = new Map(visible.map((v) => [v.id, v]))

  // "Seen" indicator: last sent message that has been read
  const lastReadMsgId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user?.id && messages[i].read_at) return messages[i].id
    }
    return null
  })()

  return (
    <div className="flex flex-col h-full" onClick={() => setPickerFor(null)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <Link href="/chat" className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        {other && (
          <>
            <Avatar src={other.avatar_url} name={other.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{other.full_name}</p>
              <p className="text-xs text-slate-400">@{other.username}</p>
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
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
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

        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id
          const prevMsg = messages[i - 1]
          const grouped =
            prevMsg &&
            prevMsg.sender_id === msg.sender_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000
          const display = visibleMap.get(msg.id)
          const content = display?.content ?? msg.content
          const wasEncrypted = display?.encrypted ?? false
          const msgReactions = reactions[msg.id] ?? []

          return (
            <div
              key={msg.id}
              className={cn('group flex items-end gap-1', isOwn && 'flex-row-reverse', grouped && 'mt-0.5')}
            >
              {/* Avatar */}
              {!grouped ? (
                <Avatar src={msg.sender.avatar_url} name={msg.sender.full_name} size="sm" className="mb-0.5 shrink-0" />
              ) : (
                <div className="w-7 shrink-0" />
              )}

              <div className={cn('max-w-[70%]', isOwn ? 'items-end flex flex-col' : '')}>
                {!grouped && (
                  <p className="text-xs text-slate-400 mb-1 px-1">
                    {isOwn ? 'You' : msg.sender.full_name} · {timeAgo(msg.created_at)}
                  </p>
                )}

                {/* Bubble / edit form */}
                {editingId === msg.id ? (
                  <form onSubmit={saveEdit} className="w-full min-w-[220px]">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-800 dark:text-slate-200"
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
                      'rounded-2xl text-sm',
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
                      <p className="px-3 py-2 whitespace-pre-wrap break-words">{content}</p>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className={cn('flex items-center gap-1 mt-0.5 px-0.5', isOwn && 'flex-row-reverse')}>
                  {(!grouped || msg.edited_at || (isOwn && msg.id === lastReadMsgId)) && (
                    <span className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</span>
                  )}
                  {wasEncrypted && <Lock size={9} className="text-emerald-500" />}
                  {msg.edited_at && <span className="text-[9px] text-slate-400 italic">(edited)</span>}
                  {isOwn && msg.id === lastReadMsgId && (
                    <span className="text-[9px] text-violet-400 flex items-center gap-0.5 font-medium">
                      <CheckCheck size={10} /> Seen
                    </span>
                  )}
                </div>

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
                'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-1 shrink-0',
                isOwn && 'order-first flex-row-reverse',
              )}>
                {/* Emoji picker trigger */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === msg.id ? null : msg.id) }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
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
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(msg) }}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id) }}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
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

        <div ref={bottomRef} />
      </div>

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
        onSubmit={sendMessage}
        className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
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
          className="p-2 text-slate-400 hover:text-violet-500 transition shrink-0"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>
        <input
          value={text}
          onChange={handleInputChange}
          placeholder={e2eActive ? `Message ${other?.full_name ?? ''} (encrypted)…` : `Message ${other?.full_name ?? ''}…`}
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={(!text.trim() && !mediaFile) || uploading}
          className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition shrink-0"
        >
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  )
}

