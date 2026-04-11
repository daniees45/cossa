'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Send, ArrowLeft, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Channel, MessageWithSender } from '@/types/app'
import Link from 'next/link'

export default function ChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = use(params)
  const { user } = useUser()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('channels').select('*').eq('id', channelId).single()
      return data as Channel
    },
  })

  // Load initial messages
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setMessages(data as unknown as MessageWithSender[])
          setHasMore(data.length === 50)
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`channel-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data: msg } = await supabase
            .from('messages')
            .select('*, sender:profiles!sender_id(*)')
            .eq('id', payload.new.id)
            .single()
          if (msg) {
            setMessages((prev) => [...prev, msg as unknown as MessageWithSender])
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

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
    // Preserve scroll position
    const container = scrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    setMessages((prev) => [...older, ...prev])
    setHasMore(data.length === 50)
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevHeight
    })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || sending) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('messages').insert({
      channel_id: channelId,
      sender_id: user.id,
      content: text.trim(),
    })
    setText('')
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link href="/chat" className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft size={18} className="text-slate-600 dark:text-slate-300" />
        </Link>
        <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <span className="text-violet-600 font-bold text-xs">#</span>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white text-sm">{channel?.name}</p>
          {channel?.description && (
            <p className="text-xs text-slate-400">{channel.description}</p>
          )}
        </div>
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
          const grouped = prevMsg && prevMsg.sender_id === msg.sender_id &&
            new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000

          return (
            <div key={msg.id} className={cn('flex gap-2.5', isOwn && 'flex-row-reverse', grouped && 'mt-0.5')}>
              {!grouped ? (
                <Avatar src={msg.sender.avatar_url} name={msg.sender.full_name} size="sm" className="mt-1 shrink-0" />
              ) : (
                <div className="w-7 shrink-0" />
              )}
              <div className={cn('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
                {!grouped && (
                  <p className="text-xs text-slate-400 mb-1">
                    {isOwn ? 'You' : msg.sender.full_name} · {timeAgo(msg.created_at)}
                  </p>
                )}
                <div className={cn(
                  'px-3 py-2 rounded-2xl text-sm',
                  isOwn
                    ? 'bg-violet-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                )}>
                  {msg.content}
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
          placeholder="Type a message…"
          className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition shrink-0"
        >
          <Send size={16} className="text-white" />
        </button>
      </form>
    </div>
  )
}
