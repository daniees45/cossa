'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { uploadFile } from '@/lib/utils/uploadFile'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Badge } from '@/components/shared/Badge'
import { Avatar } from '@/components/shared/Avatar'
import { Plus, Loader2, Trash2, Users, ChevronDown, ChevronUp, Camera } from 'lucide-react'
import { formatEventDate } from '@/lib/utils/formatDate'
import type { Election, CandidateWithProfile, Profile } from '@/types/app'

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  starts_at: z.string().min(1, 'Required'),
  ends_at: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

const blankCandidate = { position: '', manifesto: '', username: '' }

// ── Candidate panel for a single election ──────────────────────────────────
function CandidatePanel({ electionId }: { electionId: string }) {
  const qc = useQueryClient()
  const { user } = useUser()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankCandidate)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const { data: candidates = [] } = useQuery({
    queryKey: ['admin-candidates', electionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('candidates')
        .select('*, profile:profiles!user_id(id, full_name, username, avatar_url)')
        .eq('election_id', electionId)
        .order('position')
      return (data ?? []) as CandidateWithProfile[]
    },
  })

  const { mutate: deleteCandidate } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('candidates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-candidates', electionId] })
      toast.success('Candidate removed')
    },
  })

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)) }
  }

  async function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.position.trim() || !form.username.trim() || !user) return
    setSubmitting(true)
    try {
      const supabase = createClient()

      // Resolve username → user id
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('username', form.username.trim().toLowerCase())
        .single()
      if (pErr || !profile) {
        toast.error('User not found — check the username')
        return
      }

      let photo_url: string | null = null
      if (photoFile) {
        photo_url = await uploadFile(photoFile, 'avatars', `candidates/${electionId}/${profile.id}-${Date.now()}`)
      }

      const { error } = await supabase.from('candidates').insert({
        election_id: electionId,
        user_id: profile.id,
        position: form.position.trim(),
        manifesto: form.manifesto.trim() || null,
        photo_url,
      })
      if (error) {
        if (error.code === '23505') toast.error('This candidate is already in the election')
        else toast.error(error.message)
        return
      }

      toast.success(`${profile.full_name} added as candidate`)
      qc.invalidateQueries({ queryKey: ['admin-candidates', electionId] })
      setForm(blankCandidate)
      setPhotoFile(null)
      setPhotoPreview(null)
      setShowForm(false)
    } catch {
      toast.error('Failed to add candidate')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
      {/* Existing candidates */}
      {candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2">
              <Avatar src={c.photo_url ?? c.profile.avatar_url} name={c.profile.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{c.profile.full_name}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400">{c.position}</p>
                {c.manifesto && <p className="text-xs text-slate-400 truncate">{c.manifesto}</p>}
              </div>
              <button
                onClick={() => deleteCandidate(c.id)}
                className="text-slate-400 hover:text-red-500 transition shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add candidate form */}
      {showForm ? (
        <form onSubmit={handleAddCandidate} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add Candidate</p>

          {/* Photo */}
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                : <Camera size={16} className="text-slate-400" />
              }
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition rounded-full"
              >
                <Camera size={14} className="text-white" />
              </button>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhotoPick} />
            </div>
            <p className="text-xs text-slate-400">Optional photo (uses profile pic if blank)</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Username *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. john_doe"
                required
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Position *</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. President"
                required
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Manifesto</label>
            <textarea
              value={form.manifesto}
              onChange={(e) => setForm({ ...form, manifesto: e.target.value })}
              placeholder="Brief manifesto or campaign statement…"
              rows={2}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Add Candidate
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(blankCandidate); setPhotoFile(null); setPhotoPreview(null) }}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium transition"
        >
          <Plus size={13} />
          Add candidate
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminElectionsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: elections } = useQuery({
    queryKey: ['admin-elections'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('elections').select('*').order('created_at', { ascending: false })
      return (data ?? []) as Election[]
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate: createElection } = useMutation({
    mutationFn: async (data: FormData) => {
      const supabase = createClient()
      const { error } = await supabase.from('elections').insert({
        ...data,
        created_by: user!.id,
        status: 'draft',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Election created!')
      qc.invalidateQueries({ queryKey: ['admin-elections'] })
      reset()
      setCreating(false)
    },
    onError: () => toast.error('Failed to create election'),
  })

  const { mutate: changeStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'draft' | 'active' | 'closed' }) => {
      const supabase = createClient()
      await supabase.from('elections').update({ status }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-elections'] }),
  })

  const { mutate: deleteElection } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('elections').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-elections'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Elections</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition"
        >
          <Plus size={16} />
          New Election
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleSubmit((d) => createElection(d))}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white">Create Election</h3>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title</label>
            <input
              {...register('title')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
              <input
                {...register('starts_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">End Date</label>
              <input
                {...register('ends_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {elections?.map((e) => (
          <div key={e.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={e.status === 'active' ? 'success' : e.status === 'closed' ? 'default' : 'warning'}>
                    {e.status}
                  </Badge>
                </div>
                <p className="font-medium text-slate-900 dark:text-white">{e.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatEventDate(e.starts_at)} → {formatEventDate(e.ends_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Candidates toggle */}
                <button
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                >
                  <Users size={13} />
                  Candidates
                  {expandedId === e.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {e.status === 'draft' && (
                  <button
                    onClick={() => changeStatus({ id: e.id, status: 'active' })}
                    className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium"
                  >
                    Activate
                  </button>
                )}
                {e.status === 'active' && (
                  <button
                    onClick={() => changeStatus({ id: e.id, status: 'closed' })}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs font-medium"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={() => deleteElection(e.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Expandable candidate panel */}
            {expandedId === e.id && <CandidatePanel electionId={e.id} />}
          </div>
        ))}
      </div>
    </div>
  )
}
