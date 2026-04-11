'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Send, ArrowLeft, Lock, LockOpen } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { MessageWithSender, Profile } from '@/types/app'
import Link from 'next/link'
import {
  ensureKeyPair,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from '@/lib/crypto/dm'

type VisibleMsg = { id: string; content: string; encrypted: boolean }

export default function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user } = useUser()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [visible, setVisible] = useState<VisibleMsg[]>([])
  const [text, setText] = useState('')
  const [e2eActive, setE2eActive] = useState(false)
  const myPrivRef = useRef<CryptoKey | null>(null)
  const theirPubRef = useRef<CryptoKey | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: other } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      return data as Profile
    },
  })

  // ── E2EE setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !other) return

    ensureKeyPair(user.id, other.public_key ?? null).then(
      async ({ myPrivate, theirPublic, newPublicKeyB64 }) => {
        myPrivRef.current = myPrivate
        theirPubRef.current = theirPublic

        // Upload our public key to DB if we just generated it
        if (newPublicKeyB64) {
          const supabase = createClient()
          await supabase
            .from('profiles')
            .update({ public_key: newPublicKeyB64 })
            .eq('id', user.id)
        }

        setE2eActive(!!theirPublic)
      },
    )
  }, [user, other])

  // ── Decrypt messages whenever raw messages or E2EE state changes ────────────
  useEffect(() => {
    let cancelled = false
    async function decrypt() {
      const myPriv = myPrivRef.current
      const theirPub = theirPubRef.current
      const result: VisibleMsg[] = await Promise.all(
        messages.map(async (msg) => {
          if (isEncrypted(msg.content) && myPriv && theirPub) {
            try {
              return {
                id: msg.id,
                content: await decryptMessage(myPriv, theirPub, msg.content),
                encrypted: true,
              }
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

  // ── Load history + realtime subscription ────────────────────────────────────
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
        if (data) setMessages(data as unknown as MessageWithSender[])
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })

    const ch = supabase
      .channel(`dm-${user.id}-${userId}`)
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
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user, userId])

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    const supabase = createClient()
    let content = text.trim()

    if (myPrivRef.current && theirPubRef.current) {
      try {
        content = await encryptMessage(myPrivRef.current, theirPubRef.current, content)
      } catch {
        // encryption failed — fall back to plaintext
      }
    }

    setText('')
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content,
    })
  }

  const visibleMap = new Map(visible.map((v) => [v.id, v]))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
            {/* E2EE status badge */}
            <div
              title={e2eActive ? 'End-to-end encrypted' : 'No encryption — other user has not set up E2EE yet'}
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id
          const display = visibleMap.get(msg.id)
          const content = display?.content ?? msg.content
          const wasEncrypted = display?.encrypted ?? false
          return (
            <div key={msg.id} className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
              <Avatar src={msg.sender.avatar_url} name={msg.sender.full_name} size="sm" className="shrink-0 mt-1" />
              <div className={cn('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
                <div className={cn(
                  'px-3 py-2 rounded-2xl text-sm',
                  isOwn
                    ? 'bg-violet-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm',
                )}>
                  {content}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[10px] text-slate-400">{timeAgo(msg.created_at)}</p>
                  {wasEncrypted && <Lock size={9} className="text-emerald-500" />}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={e2eActive ? `Message ${other?.full_name ?? ''} (encrypted)…` : `Message ${other?.full_name ?? ''}…`}
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition"
        >
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  )
}
