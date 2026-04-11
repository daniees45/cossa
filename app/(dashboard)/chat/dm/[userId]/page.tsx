'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Send, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { timeAgo } from '@/lib/utils/formatDate'
import type { MessageWithSender, Profile } from '@/types/app'
import Link from 'next/link'

export default function DMPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user } = useUser()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: other } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      return data as Profile
    },
  })

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as MessageWithSender[])
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      })

    const ch = supabase
      .channel(`dm-${user.id}-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.sender_id !== userId) return
        const { data: msg } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(*)')
          .eq('id', payload.new.id)
          .single()
        if (msg) {
          setMessages((prev) => [...prev, msg as MessageWithSender])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [user, userId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    const supabase = createClient()
    const content = text.trim()
    setText('')
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content,
    })
  }

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
            <div>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{other.full_name}</p>
              <p className="text-xs text-slate-400">@{other.username}</p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
              <Avatar src={msg.sender.avatar_url} name={msg.sender.full_name} size="sm" className="shrink-0 mt-1" />
              <div className={cn('max-w-[75%]', isOwn && 'items-end flex flex-col')}>
                <div className={cn(
                  'px-3 py-2 rounded-2xl text-sm',
                  isOwn
                    ? 'bg-violet-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                )}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(msg.created_at)}</p>
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
          placeholder={`Message ${other?.full_name ?? ''}…`}
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
