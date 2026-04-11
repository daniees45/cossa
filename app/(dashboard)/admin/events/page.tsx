'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { uploadFile } from '@/lib/utils/uploadFile'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Calendar, MapPin, Image as ImageIcon, Pencil } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'
import { formatDate } from '@/lib/utils/formatDate'

type EventType = 'social_event' | 'competition' | 'seminar' | 'fun'

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'social_event', label: 'Social Event' },
  { value: 'competition', label: 'Competition' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'fun', label: 'Fun' },
]

const blankForm = {
  title: '',
  description: '',
  type: 'social_event' as EventType,
  location: '',
  event_date: '',
  coverFile: null as File | null,
}

export default function AdminEventsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const { confirm } = useDialog()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false })
      return data ?? []
    },
  })

  const { mutate: deleteEvent } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('events').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] })
      toast.success('Event deleted')
    },
  })

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setForm((f) => ({ ...f, coverFile: file }))
    setCoverPreview(URL.createObjectURL(file))
  }

  function startEdit(ev: typeof events[0]) {
    setEditingId(ev.id)
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      type: ev.type as EventType,
      location: ev.location ?? '',
      event_date: ev.event_date ? new Date(ev.event_date).toISOString().slice(0, 16) : '',
      coverFile: null,
    })
    setCoverPreview(ev.cover_url ?? null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(blankForm)
    setCoverPreview(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      let cover_url: string | undefined = undefined
      if (form.coverFile) {
        const path = `events/${Date.now()}-${form.coverFile.name}`
        cover_url = await uploadFile(form.coverFile, 'covers', path)
      }

      if (editingId) {
        const updatePayload: {
          title: string
          description: string | null
          type: EventType
          location: string | null
          event_date: string
          cover_url?: string | null
        } = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: form.type,
          location: form.location.trim() || null,
          event_date: new Date(form.event_date).toISOString(),
        }
        if (cover_url !== undefined) updatePayload.cover_url = cover_url
        const { error } = await supabase.from('events').update(updatePayload).eq('id', editingId)
        if (error) throw error
        toast.success('Event updated!')
      } else {
        const { error } = await supabase.from('events').insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          type: form.type,
          location: form.location.trim() || null,
          event_date: new Date(form.event_date).toISOString(),
          cover_url: cover_url ?? null,
          created_by: user!.id,
        })
        if (error) throw error
        toast.success('Event created!')
      }

      cancelForm()
      qc.invalidateQueries({ queryKey: ['admin-events'] })
    } catch {
      toast.error(editingId ? 'Failed to update event' : 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage COSSA events and gatherings</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(!showForm) }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          New Event
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Event' : 'Create Event'}</h2>

          {/* Cover image */}
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Cover Image</label>
            <div className="flex items-center gap-4">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" className="w-32 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-32 h-20 bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                  <ImageIcon size={22} className="text-slate-400" />
                </div>
              )}
              <label className="cursor-pointer text-sm text-violet-600 hover:text-violet-700 font-medium">
                {coverPreview ? 'Change cover' : 'Upload cover'}
                <input type="file" accept="image/*" hidden onChange={handleCoverPick} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Event title"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Event details…"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Venue or Online"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Event'}
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

      {/* Events List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-600" size={28} />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No events yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const typeObj = EVENT_TYPES.find((t) => t.value === ev.type)
            const isPast = new Date(ev.event_date) < new Date()
            return (
              <div
                key={ev.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex"
              >
                {ev.cover_url && (
                  <img src={ev.cover_url} alt={ev.title} className="w-24 md:w-32 object-cover shrink-0" />
                )}
                <div className="flex-1 p-4 flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {typeObj?.label}
                      </span>
                      {isPast && (
                        <span className="text-xs text-slate-400">Past</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{ev.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {formatDate(ev.event_date)}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {ev.location}
                        </span>
                      )}
                      <span>{ev.rsvp_count} RSVP{ev.rsvp_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(ev)}
                    title="Edit"
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors shrink-0"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: 'Delete event', message: 'This event will be permanently deleted.', confirmLabel: 'Delete', variant: 'danger' })) deleteEvent(ev.id)
                    }}
                    title="Delete"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
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
