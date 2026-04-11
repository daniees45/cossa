'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Hash, Lock, Megaphone, Pencil } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'
import { formatDate } from '@/lib/utils/formatDate'

type ChannelType = 'public' | 'private' | 'announcement'

const TYPE_ICONS: Record<ChannelType, React.ReactNode> = {
  public: <Hash size={14} />,
  private: <Lock size={14} />,
  announcement: <Megaphone size={14} />,
}

const TYPE_COLORS: Record<ChannelType, string> = {
  public: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  private: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  announcement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminChannelsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const { confirm } = useDialog()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', type: 'public' as ChannelType })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['admin-channels'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { mutate: deleteChannel } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('channels').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success('Channel deleted')
    },
  })

  function startEdit(ch: typeof channels[0]) {
    setEditingId(ch.id)
    setForm({ name: ch.name, description: ch.description ?? '', type: ch.type as ChannelType })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', type: 'public' })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (editingId) {
      setSubmitting(true)
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('channels')
          .update({ description: form.description.trim() || null, type: form.type })
          .eq('id', editingId)
        if (error) throw error
        toast.success('Channel updated!')
        cancelForm()
        qc.invalidateQueries({ queryKey: ['admin-channels'] })
      } catch {
        toast.error('Failed to update channel')
      } finally {
        setSubmitting(false)
      }
      return
    }
    const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!slug) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('channels').insert({
        name: slug,
        description: form.description.trim() || null,
        type: form.type,
        created_by: user!.id,
      })
      if (error) throw error
      toast.success(`#${slug} created!`)
      cancelForm()
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
    } catch {
      toast.error('Failed to create channel')
    } finally {
      setSubmitting(false)
    }
  }

  const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Channels</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage public chat channels</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(!showForm) }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          New Channel
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Channel' : 'Create Channel'}</h2>

          {editingId ? (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Hash size={14} />
              <span className="font-mono">{form.name}</span>
              <span className="text-xs text-slate-400">(name cannot be changed)</span>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Channel Name *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">#</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="general"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              {slug && form.name !== slug && (
                <p className="text-xs text-slate-400 mt-1">Will be created as <span className="text-violet-500">#{slug}</span></p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this channel for?"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Type</label>
            <div className="flex gap-3 flex-wrap">
              {(['public', 'private', 'announcement'] as ChannelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    form.type === t
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {TYPE_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {form.type === 'public' && 'Visible and joinable by all members'}
              {form.type === 'private' && 'Invite-only — members must be added manually'}
              {form.type === 'announcement' && 'Only admins can post; members can read'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Channel'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Channels List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-600" size={28} />
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <Hash size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No channels yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => {
            const type = ch.type as ChannelType
            return (
              <div
                key={ch.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[type]}`}>
                    {TYPE_ICONS[type]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">#{ch.name}</p>
                    {ch.description && (
                      <p className="text-xs text-slate-500 truncate">{ch.description}</p>
                    )}
                    <p className="text-xs text-slate-400">{formatDate(ch.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[type]}`}>
                    {type}
                  </span>
                  <button
                    onClick={() => startEdit(ch)}
                    title="Edit"
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: `Delete #${ch.name}`, message: 'This will permanently delete the channel and all its messages. This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })) deleteChannel(ch.id)
                    }}
                    title="Delete channel"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
