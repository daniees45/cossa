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
import { Plus, Loader2, Trash2, Users, ChevronDown, ChevronUp, Camera, Search, ShieldCheck } from 'lucide-react'
import { formatEventDate } from '@/lib/utils/formatDate'
import type { Election, CandidateWithProfile } from '@/types/app'

const LEVELS = ['100', '200', '300', '400', 'postgrad'] as const

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  starts_at: z.string().min(1, 'Required'),
  ends_at: z.string().min(1, 'Required'),
  require_index_number: z.boolean(),
  eligible_levels: z.array(z.string()).optional(),
})
type FormData = z.infer<typeof schema>

const blankCandidate = { position: '', manifesto: '', username: '' }

type ResolvedProfile = {
  id: string; full_name: string; username: string; avatar_url: string | null
  department: string | null; level: string | null
}

// ── Candidate panel for a single election ──────────────────────────────────
function CandidatePanel({ electionId }: { electionId: string }) {
  const qc = useQueryClient()
  const { user } = useUser()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankCandidate)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resolvedProfile, setResolvedProfile] = useState<ResolvedProfile | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const { data: candidates = [] } = useQuery({
    queryKey: ['admin-candidates', electionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('candidates')
        .select('*, profile:profiles!user_id(id, full_name, username, avatar_url, department, level)')
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

  async function lookupUsername() {
    if (!form.username.trim()) return
    setLookingUp(true)
    setResolvedProfile(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, department, level')
        .eq('username', form.username.trim().toLowerCase())
        .single()
      if (error || !data) { toast.error('User not found — check the username'); return }
      setResolvedProfile(data as ResolvedProfile)
    } finally {
      setLookingUp(false)
    }
  }

  async function handleAddCandidate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.position.trim() || !form.manifesto.trim() || !resolvedProfile || !user) {
      if (!resolvedProfile) { toast.error('Look up a username first'); return }
      return
    }
    setSubmitting(true)
    try {
      const supabase = createClient()

      let photo_url: string | null = null
      if (photoFile) {
        photo_url = await uploadFile(photoFile, 'avatars', `candidates/${electionId}/${resolvedProfile.id}-${Date.now()}`)
      }

      const { error } = await supabase.from('candidates').insert({
        election_id: electionId,
        user_id: resolvedProfile.id,
        position: form.position.trim(),
        manifesto: form.manifesto.trim(),
        photo_url,
        department: resolvedProfile.department,
        level: resolvedProfile.level,
      } as never)
      if (error) {
        if (error.code === '23505') toast.error('This candidate is already in the election')
        else toast.error(error.message)
        return
      }

      toast.success(`${resolvedProfile.full_name} added as candidate`)
      qc.invalidateQueries({ queryKey: ['admin-candidates', electionId] })
      setForm(blankCandidate)
      setPhotoFile(null)
      setPhotoPreview(null)
      setResolvedProfile(null)
      setShowForm(false)
    } catch {
      toast.error('Failed to add candidate')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setShowForm(false)
    setForm(blankCandidate)
    setPhotoFile(null)
    setPhotoPreview(null)
    setResolvedProfile(null)
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
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.profile.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400">{c.position}</span>
                  {c.profile.level && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Level {c.profile.level}</span>}
                  {c.profile.department && <span className="text-[10px] text-slate-400 truncate">{c.profile.department}</span>}
                </div>
                {c.manifesto && <p className="text-xs text-slate-400 truncate mt-0.5">{c.manifesto}</p>}
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
        <form onSubmit={handleAddCandidate} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add Candidate</p>

          {/* Username lookup */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Username *</label>
            <div className="flex gap-2">
              <input
                value={form.username}
                onChange={(e) => { setForm({ ...form, username: e.target.value }); setResolvedProfile(null) }}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookupUsername())}
                placeholder="e.g. john_doe"
                required
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={lookupUsername}
                disabled={lookingUp || !form.username.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg"
              >
                {lookingUp ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                Look up
              </button>
            </div>
          </div>

          {/* Resolved profile preview */}
          {resolvedProfile && (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2.5">
              <Avatar src={resolvedProfile.avatar_url} name={resolvedProfile.full_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{resolvedProfile.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-slate-500">@{resolvedProfile.username}</span>
                  {resolvedProfile.level && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Level {resolvedProfile.level}</span>}
                  {resolvedProfile.department && <span className="text-xs text-slate-400">{resolvedProfile.department}</span>}
                </div>
              </div>
              <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓ Found</span>
            </div>
          )}

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
            <p className="text-xs text-slate-400">Optional photo — uses profile picture if blank</p>
          </div>

          {/* Position */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Position / Role *</label>
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g. President, PRO, Financial Secretary"
              required
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Manifesto — required */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Manifesto / Campaign Statement *
              <span className="ml-1 text-slate-400">(min 20 characters)</span>
            </label>
            <textarea
              value={form.manifesto}
              onChange={(e) => setForm({ ...form, manifesto: e.target.value })}
              placeholder="What will this candidate do if elected? Describe their agenda, goals and qualifications…"
              rows={4}
              minLength={20}
              required
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-0.5 text-right">{form.manifesto.length} chars</p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !resolvedProfile}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Add Candidate
            </button>
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium transition">
          <Plus size={13} />
          Add candidate
        </button>
      )}
    </div>
  )
}

export default function AdminElectionsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])

  const { data: elections } = useQuery({
    queryKey: ['admin-elections'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('elections').select('*').order('created_at', { ascending: false })
      return (data ?? []) as Election[]
    },
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { require_index_number: false, eligible_levels: [] },
  })

  function toggleLevel(level: string) {
    const next = selectedLevels.includes(level)
      ? selectedLevels.filter((l) => l !== level)
      : [...selectedLevels, level]
    setSelectedLevels(next)
    setValue('eligible_levels', next)
  }

  const requireIndexNumber = watch('require_index_number')

  const { mutate: createElection } = useMutation({
    mutationFn: async (data: FormData) => {
      const supabase = createClient()
      const { error } = await supabase.from('elections').insert({
        title: data.title,
        description: data.description,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        require_index_number: data.require_index_number,
        eligible_levels: data.eligible_levels?.length ? data.eligible_levels : null,
        created_by: user!.id,
        status: 'draft',
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Election created!')
      qc.invalidateQueries({ queryKey: ['admin-elections'] })
      reset()
      setSelectedLevels([])
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

      {creating && (
        <form
          onSubmit={handleSubmit((d) => createElection(d))}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white">Create Election</h3>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title *</label>
            <input
              {...register('title')}
              placeholder="e.g. COSSA 2025/2026 Executive Elections"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Brief description of this election…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Start Date *</label>
              <input
                {...register('starts_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">End Date *</label>
              <input
                {...register('ends_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Eligibility */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-violet-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Voter Eligibility</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Restrict to specific levels (leave blank = all levels)</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => toggleLevel(lvl)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      selectedLevels.includes(lvl)
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-400'
                    }`}
                  >
                    {lvl === 'postgrad' ? 'Postgrad' : `${lvl} Level`}
                  </button>
                ))}
              </div>
              {selectedLevels.length > 0 && (
                <p className="text-xs text-violet-600 mt-1.5">
                  Only {selectedLevels.map((l) => l === 'postgrad' ? 'Postgrad' : `${l}L`).join(', ')} students can vote
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('require_index_number')}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">Require index number</p>
                <p className="text-xs text-slate-400">Only students with index number in their profile can vote</p>
              </div>
            </label>
            {requireIndexNumber && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">Voters without an index number will be blocked.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Create Election
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setSelectedLevels([]) }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {elections?.map((e) => {
          const el = e as Election & { require_index_number?: boolean; eligible_levels?: string[] | null }
          return (
            <div key={el.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant={el.status === 'active' ? 'success' : el.status === 'closed' ? 'default' : 'warning'}>
                      {el.status}
                    </Badge>
                    {el.require_index_number && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={10} /> Index required
                      </span>
                    )}
                    {el.eligible_levels && el.eligible_levels.length > 0 && (
                      <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full">
                        {el.eligible_levels.join(', ')} only
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{el.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatEventDate(el.starts_at)} → {formatEventDate(el.ends_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === el.id ? null : el.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    <Users size={13} />
                    Candidates
                    {expandedId === el.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {el.status === 'draft' && (
                    <button
                      onClick={() => changeStatus({ id: el.id, status: 'active' })}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium"
                    >
                      Activate
                    </button>
                  )}
                  {el.status === 'active' && (
                    <button
                      onClick={() => changeStatus({ id: el.id, status: 'closed' })}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs font-medium"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => deleteElection(el.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expandedId === el.id && <CandidatePanel electionId={el.id} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
