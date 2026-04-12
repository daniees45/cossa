'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { toast } from 'sonner'
import { Bell, Loader2, Send, Users } from 'lucide-react'
import { timeAgo } from '@/lib/utils/formatDate'

const LEVELS = ['100', '200', '300', '400', 'postgrad'] as const

const blankForm = {
  title: '',
  body: '',
  link: '',
  levels: [] as string[],
}

export default function AdminNotificationsPage() {
  const { user } = useUser()
  const [form, setForm] = useState(blankForm)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<{ count: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Recent broadcasts — sample from the notifications table (type = 'broadcast')
  const { data: recent = [], refetch } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: async () => {
      const supabase = createClient()
      // Get distinct broadcasts by created_at rounded to nearest second
      const { data } = await supabase
        .from('notifications')
        .select('title, body, link, created_at')
        .eq('type', 'broadcast')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!data) return []
      // De-duplicate: keep only first occurrence of each title+body combo
      const seen = new Set<string>()
      return data.filter((n) => {
        const key = `${n.title}||${n.body}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 10)
    },
  })

  function toggleLevel(level: string) {
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(level)
        ? f.levels.filter((l) => l !== level)
        : [...f.levels, level],
    }))
    setPreview(null)
  }

  async function handlePreview() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Fill in title and message first')
      return
    }
    setPreviewing(true)
    try {
      const supabase = createClient()
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true })
      if (form.levels.length > 0) {
        query = query.in('level', form.levels) as typeof query
      }
      const { count } = await query
      setPreview({ count: count ?? 0 })
    } catch {
      toast.error('Failed to estimate recipients')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    if (!user) return
    setSending(true)
    try {
      const supabase = createClient()
      const { data: count, error } = await supabase.rpc('broadcast_notification', {
        p_title: form.title.trim(),
        p_body: form.body.trim(),
        p_link: form.link.trim() || null,
        p_levels: form.levels.length > 0 ? form.levels : null,
      })
      if (error) throw error
      toast.success(`Notification sent to ${count} user${count !== 1 ? 's' : ''}!`)
      setForm(blankForm)
      setPreview(null)
      refetch()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send notification'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Broadcast Notifications</h1>
        <p className="text-sm text-slate-500 mt-0.5">Send a notification to all students or a specific year group</p>
      </div>

      {/* Compose form */}
      <form
        onSubmit={handleSend}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Bell size={16} className="text-violet-500" />
          Compose
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => { setForm({ ...form, title: e.target.value }); setPreview(null) }}
            placeholder="e.g. Exam timetable released"
            required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Message *</label>
          <textarea
            value={form.body}
            onChange={(e) => { setForm({ ...form, body: e.target.value }); setPreview(null) }}
            placeholder="Write the notification message…"
            rows={3}
            required
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Link (optional)</label>
          <input
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="/vote  or  /info  or any path"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Target audience
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, levels: [] })); setPreview(null) }}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                form.levels.length === 0
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
              }`}
            >
              All students
            </button>
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                  form.levels.includes(level)
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                }`}
              >
                {level === 'postgrad' ? 'Postgrad' : `${level} Level`}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient preview */}
        {preview && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3">
            <Users size={15} className="text-violet-500 shrink-0" />
            <span>
              This will be sent to <strong className="text-slate-900 dark:text-white">{preview.count}</strong> user{preview.count !== 1 ? 's' : ''}
              {form.levels.length > 0 ? ` (${form.levels.map((l) => l === 'postgrad' ? 'Postgrad' : `${l} Level`).join(', ')})` : ''}
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          {!preview && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {previewing && <Loader2 size={14} className="animate-spin" />}
              Preview recipients
            </button>
          )}
          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </div>
      </form>

      {/* Recent broadcasts */}
      {recent.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Broadcasts</h2>
          <div className="space-y-2">
            {recent.map((n, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 sm:px-5 py-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    {n.link && (
                      <p className="text-xs text-violet-600 mt-0.5 truncate">{n.link}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
