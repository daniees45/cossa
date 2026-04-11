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
import { Plus, Loader2, Trash2, Users, ChevronDown, ChevronUp, Camera, Search, ShieldCheck, ClipboardList, X, Vote } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'
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

// ── Voter Roll panel ──────────────────────────────────────────────────────────
type VoterRollRow = { id: string; student_id: string; full_name: string; voter_id: string | null }

function VoterRollPanel({ electionId }: { electionId: string }) {
  const { confirm } = useDialog()
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<{ student_id: string; full_name: string }[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)

  const { data: rolls = [], refetch } = useQuery<VoterRollRow[]>({
    queryKey: ['voter-rolls', electionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('voter_rolls')
        .select('id, student_id, full_name, voter_id')
        .eq('election_id', electionId)
        .order('created_at', { ascending: true })
      return (data ?? []) as VoterRollRow[]
    },
  })

  function parsePaste() {
    setParseError('')
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
    const entries: { student_id: string; full_name: string }[] = []
    const errors: string[] = []
    lines.forEach((line, i) => {
      // Support comma or tab as delimiter
      const parts = line.split(/[,\t]/).map((p) => p.trim())
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        errors.push(`Line ${i + 1}: expected "STUDENT_ID, Full Name" — got "${line}"`)
        return
      }
      entries.push({ student_id: parts[0].toUpperCase(), full_name: parts.slice(1).join(' ') })
    })
    if (errors.length) { setParseError(errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n…and ${errors.length - 3} more` : '')); return }
    setParsed(entries)
  }

  async function handleImport() {
    if (!parsed.length) return
    setImporting(true)
    try {
      const supabase = createClient()
      const rows = parsed.map((p) => ({ election_id: electionId, student_id: p.student_id, full_name: p.full_name }))
      const { error } = await supabase.from('voter_rolls').upsert(rows, { onConflict: 'election_id,student_id' })
      if (error) { toast.error(error.message); return }
      toast.success(`${rows.length} student ID${rows.length !== 1 ? 's' : ''} imported`)
      setRawText('')
      setParsed([])
      refetch()
    } finally {
      setImporting(false)
    }
  }

  async function clearAll() {
    const ok = await confirm({ title: 'Clear voter roll', message: `Delete all ${rolls.length} voter roll entr${rolls.length !== 1 ? 'ies' : 'y'} for this election? This cannot be undone.`, confirmLabel: 'Clear all', variant: 'danger' })
    if (!ok) return
    setClearing(true)
    const supabase = createClient()
    await supabase.from('voter_rolls').delete().eq('election_id', electionId)
    toast.success('Voter roll cleared')
    setClearing(false)
    refetch()
  }

  async function deleteEntry(id: string) {
    const supabase = createClient()
    await supabase.from('voter_rolls').delete().eq('id', id)
    refetch()
  }

  const usedCount = rolls.filter((r) => r.voter_id).length

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2">
          <ClipboardList size={14} className="text-violet-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{rolls.length}</span>
          <span className="text-xs text-slate-400">eligible students</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2">
          <span className="text-sm font-semibold text-green-600">{usedCount}</span>
          <span className="text-xs text-slate-400">verified / voted</span>
        </div>
        {rolls.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium ml-auto"
          >
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Clear all
          </button>
        )}
      </div>

      {/* Paste import */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Import voter list
        </p>
        <p className="text-xs text-slate-400">
          One student per line: <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">STUDENT_ID, Full Name</code> or tab-separated.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setParsed([]); setParseError('') }}
          placeholder={"CS/2020/001, John Kwame Doe\nCS/2020/002, Alice Mensah\n10201234, Bob Asante"}
          rows={5}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500 resize-y"
        />
        {parseError && (
          <pre className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 whitespace-pre-wrap">{parseError}</pre>
        )}
        {parsed.length > 0 && (
          <div className="border border-green-200 dark:border-green-800 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                {parsed.length} entries ready to import
              </p>
              <button onClick={() => setParsed([])} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {parsed.slice(0, 50).map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 shrink-0">{p.student_id}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{p.full_name}</span>
                </div>
              ))}
              {parsed.length > 50 && (
                <p className="text-[10px] text-slate-400 px-3 py-1.5">…and {parsed.length - 50} more</p>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={parsePaste}
            disabled={!rawText.trim()}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
          >
            Preview
          </button>
          {parsed.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium disabled:opacity-60 hover:bg-violet-500 transition"
            >
              {importing && <Loader2 size={11} className="animate-spin" />}
              Import {parsed.length} entries
            </button>
          )}
        </div>
      </div>

      {/* Existing entries */}
      {rolls.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Imported IDs ({rolls.length})</p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {rolls.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 shrink-0 w-24 truncate">{r.student_id}</span>
                <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{r.full_name}</span>
                {r.voter_id
                  ? <span className="text-[10px] text-green-600 font-medium shrink-0">✓ verified</span>
                  : <span className="text-[10px] text-slate-400 shrink-0">pending</span>
                }
                {!r.voter_id && (
                  <button onClick={() => deleteEntry(r.id)} className="text-slate-300 hover:text-red-500 transition shrink-0">
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
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
      return (data ?? []) as unknown as CandidateWithProfile[]
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
      })
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
  const { confirm } = useDialog()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [voterRollId, setVoterRollId] = useState<string | null>(null)
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
      })
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

  const electionList = elections ?? []
  const draftCount = electionList.filter((e) => e.status === 'draft').length
  const activeCount = electionList.filter((e) => e.status === 'active').length
  const closedCount = electionList.filter((e) => e.status === 'closed').length

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 via-slate-900/20 to-emerald-500/10 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-white">Election Command</h2>
            <p className="mt-1 text-sm text-slate-300">Create ballots, configure eligibility, and monitor campaign flow.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200">Draft: {draftCount}</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">Active: {activeCount}</span>
            <span className="rounded-full border border-slate-300/25 bg-slate-500/15 px-3 py-1 text-xs text-slate-200">Closed: {closedCount}</span>
            <button
              onClick={() => setCreating(!creating)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition"
            >
              <Plus size={16} />
              New Election
            </button>
          </div>
        </div>
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
                    {el.status === 'active' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        ● VOTING LIVE
                      </span>
                    )}
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
                  <button
                    onClick={() => setVoterRollId(voterRollId === el.id ? null : el.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    <ClipboardList size={13} />
                    Voter Roll
                    {voterRollId === el.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {el.status === 'draft' && (
                    <button
                      onClick={() => changeStatus({ id: el.id, status: 'active' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition"
                    >
                      <Vote size={12} /> Enable Voting
                    </button>
                  )}
                  {el.status === 'active' && (
                    <button
                      onClick={() => changeStatus({ id: el.id, status: 'closed' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 text-xs font-semibold transition"
                    >
                      <Vote size={12} /> Stop Voting
                    </button>
                  )}
                  {el.status === 'closed' && (
                    <button
                      onClick={() => changeStatus({ id: el.id, status: 'active' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold transition"
                    >
                      <Vote size={12} /> Reopen
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
              {voterRollId === el.id && <VoterRollPanel electionId={el.id} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
