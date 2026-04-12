'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { toast } from 'sonner'
import { Plus, Trash2, Pin, PinOff, Loader2, Megaphone, Pencil } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'
import { formatDate } from '@/lib/utils/formatDate'

type Category = 'news' | 'academic' | 'urgent'

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'news', label: 'News', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'academic', label: 'Academic', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
]

export default function AdminAnnouncementsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const { confirm } = useDialog()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: 'news' as Category, pinned: false })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { mutate: deleteAnn } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('announcements').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
      toast.success('Announcement deleted')
    },
  })

  const { mutate: togglePin } = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const supabase = createClient()
      await supabase.from('announcements').update({ pinned }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-announcements'] }),
  })

  function startEdit(ann: typeof announcements[0]) {
    setEditingId(ann.id)
    setForm({ title: ann.title, body: ann.body, category: ann.category as Category, pinned: ann.pinned })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', body: '', category: 'news', pinned: false })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      if (editingId) {
        const { error } = await supabase.from('announcements').update({
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          pinned: form.pinned,
        }).eq('id', editingId)
        if (error) throw error
        toast.success('Announcement updated!')
      } else {
        const { error } = await supabase.from('announcements').insert({
          title: form.title.trim(),
          body: form.body.trim(),
          category: form.category,
          pinned: form.pinned,
          author_id: user!.id,
        })
        if (error) throw error
        toast.success('Announcement created!')
      }
      cancelForm()
      qc.invalidateQueries({ queryKey: ['admin-announcements'] })
    } catch {
      toast.error(editingId ? 'Failed to update' : 'Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Publish news, academic updates, and urgent notices</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(!showForm) }}
          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          New Announcement
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Announcement' : 'Create Announcement'}</h2>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Announcement title"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Body *</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Announcement content…"
              rows={5}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              required
            />
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none pb-2">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="accent-violet-600 w-4 h-4"
                />
                Pin to top
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Publish'}
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

      {/* Announcements List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-600" size={28} />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No announcements yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const cat = CATEGORIES.find((c) => c.value === ann.category)
            return (
              <div
                key={ann.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.pinned && (
                        <span className="text-xs font-medium text-violet-600 flex items-center gap-1">
                          <Pin size={11} /> Pinned
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat?.color}`}>
                        {cat?.label}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(ann.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{ann.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{ann.body}</p>
                  </div>
                  <div className="flex items-center flex-wrap gap-1 shrink-0 sm:justify-end">
                    <button
                      onClick={() => startEdit(ann)}
                      title="Edit"
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => togglePin({ id: ann.id, pinned: !ann.pinned })}
                      title={ann.pinned ? 'Unpin' : 'Pin'}
                      className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                    >
                      {ann.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Delete announcement', message: 'This announcement will be permanently removed.', confirmLabel: 'Delete', variant: 'danger' })) deleteAnn(ann.id)
                      }}
                      title="Delete"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
