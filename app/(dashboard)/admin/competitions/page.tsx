'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Trophy, Star, CheckCircle, Edit2, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatDate'

type Status = 'upcoming' | 'active' | 'ended'
type CompType = 'hackathon' | 'quiz' | 'coding_challenge'

const STATUS_COLORS: Record<Status, string> = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ended: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

const blankForm = {
  title: '',
  description: '',
  type: 'hackathon' as CompType,
  rules: '',
  prizes: '',
  status: 'upcoming' as Status,
  starts_at: '',
  ends_at: '',
  max_team_size: 4,
}

export default function AdminCompetitionsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Scoring state
  const [scoringCompId, setScoringCompId] = useState<string | null>(null)

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ['admin-competitions'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('competitions')
        .select('*')
        .order('starts_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: submissions = [] } = useQuery({
    queryKey: ['admin-comp-submissions', scoringCompId],
    enabled: !!scoringCompId,
    queryFn: async () => {
      if (!scoringCompId) return []
      const supabase = createClient()
      const { data } = await supabase
        .from('competition_submissions')
        .select('*, submitter:profiles!submitter_id(full_name, username, avatar_url)')
        .eq('competition_id', scoringCompId)
        .order('score', { ascending: false, nullsFirst: false })
      return data ?? []
    },
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const supabase = createClient()
      await supabase.from('competitions').update({ status }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-competitions'] }),
  })

  const { mutate: deleteComp } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('competitions').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-competitions'] })
      toast.success('Competition deleted')
    },
  })

  const { mutate: saveScore } = useMutation({
    mutationFn: async ({ id, score, rank }: { id: string; score: number; rank: number }) => {
      const supabase = createClient()
      await supabase.from('competition_submissions').update({ score, rank }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-comp-submissions', scoringCompId] })
      toast.success('Score saved')
    },
  })

  function startEdit(comp: typeof competitions[0]) {
    setEditingId(comp.id)
    setForm({
      title: comp.title,
      description: comp.description ?? '',
      type: comp.type as CompType,
      rules: comp.rules ?? '',
      prizes: comp.prizes ?? '',
      status: comp.status as Status,
      starts_at: comp.starts_at ? new Date(comp.starts_at).toISOString().slice(0, 16) : '',
      ends_at: comp.ends_at ? new Date(comp.ends_at).toISOString().slice(0, 16) : '',
      max_team_size: comp.max_team_size ?? 4,
    })
    setShowForm(true)
    setScoringCompId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(blankForm)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.starts_at || !form.ends_at) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        rules: form.rules.trim() || null,
        prizes: form.prizes.trim() || null,
        status: form.status,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        max_team_size: form.max_team_size,
      }
      if (editingId) {
        const { error } = await supabase.from('competitions').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Competition updated!')
      } else {
        const { error } = await supabase.from('competitions').insert(payload)
        if (error) throw error
        toast.success('Competition created!')
      }
      cancelForm()
      qc.invalidateQueries({ queryKey: ['admin-competitions'] })
    } catch {
      toast.error(editingId ? 'Failed to update competition' : 'Failed to create competition')
    } finally {
      setSubmitting(false)
    }
  }

  const scoringComp = competitions.find((c) => c.id === scoringCompId)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Competitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage hackathons, quizzes, and coding challenges</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(!showForm); setScoringCompId(null) }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} />
          New Competition
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Competition' : 'Create Competition'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Competition title"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CompType })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="hackathon">Hackathon</option>
                <option value="quiz">Quiz</option>
                <option value="coding_challenge">Coding Challenge</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Initial Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Starts *</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Ends *</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Max Team Size</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.max_team_size}
                onChange={(e) => setForm({ ...form, max_team_size: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this competition about?"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Rules</label>
            <textarea
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              placeholder="Competition rules and guidelines…"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Prizes</label>
            <textarea
              value={form.prizes}
              onChange={(e) => setForm({ ...form, prizes: e.target.value })}
              placeholder="1st place: GHS 500, 2nd place: GHS 300…"
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Competition'}
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

      {/* Scoring Panel */}
      {scoringCompId && scoringComp && (
        <div className="bg-white dark:bg-slate-800 border border-violet-300 dark:border-violet-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Star size={18} className="text-yellow-500" />
              Scoring: {scoringComp.title}
            </h2>
            <button onClick={() => setScoringCompId(null)} className="text-sm text-slate-400 hover:text-slate-600">
              Close panel
            </button>
          </div>

          {submissions.length === 0 ? (
            <p className="text-sm text-slate-500">No submissions yet for this competition.</p>
          ) : (
            <div className="space-y-3">
              {(submissions as unknown as Array<{
                id: string
                team_name: string | null
                submitter: { full_name: string; username: string } | null
                score: number | null
                rank: number | null
              }>).map((sub, idx) => (
                <ScoreRow
                  key={sub.id}
                  sub={sub}
                  defaultRank={idx + 1}
                  onSave={(score, rank) => saveScore({ id: sub.id, score, rank })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Competitions List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-600" size={28} />
        </div>
      ) : competitions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <Trophy size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No competitions yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitions.map((comp) => (
            <div key={comp.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[comp.status as Status]}`}>
                      {comp.status}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{comp.type.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-400">{formatDate(comp.starts_at)}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{comp.title}</h3>
                  {comp.prizes && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <Trophy size={11} /> {comp.prizes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  {/* Status transitions */}
                  {comp.status === 'upcoming' && (
                    <button
                      onClick={() => updateStatus({ id: comp.id, status: 'active' })}
                      className="flex items-center gap-1 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle size={12} /> Activate
                    </button>
                  )}
                  {comp.status === 'active' && (
                    <button
                      onClick={() => updateStatus({ id: comp.id, status: 'ended' })}
                      className="flex items-center gap-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      End
                    </button>
                  )}
                  <button
                    onClick={() => setScoringCompId(scoringCompId === comp.id ? null : comp.id)}
                    className="flex items-center gap-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Edit2 size={12} /> Score
                  </button>
                  <button
                    onClick={() => startEdit(comp)}
                    title="Edit"
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this competition and all submissions?')) deleteComp(comp.id)
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRow({
  sub,
  defaultRank,
  onSave,
}: {
  sub: { id: string; team_name: string | null; submitter: { full_name: string; username: string } | null; score: number | null; rank: number | null }
  defaultRank: number
  onSave: (score: number, rank: number) => void
}) {
  const [score, setScore] = useState(sub.score?.toString() ?? '')
  const [rank, setRank] = useState(sub.rank?.toString() ?? defaultRank.toString())

  return (
    <div className="flex items-center gap-3 text-sm flex-wrap border border-slate-100 dark:border-slate-700 rounded-xl p-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white">{sub.team_name ?? sub.submitter?.full_name ?? 'Unknown'}</p>
        <p className="text-xs text-slate-500">@{sub.submitter?.username}</p>
      </div>
      <input
        type="number"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        placeholder="Score"
        className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-500"
      />
      <input
        type="number"
        value={rank}
        onChange={(e) => setRank(e.target.value)}
        placeholder="Rank"
        min={1}
        className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-500"
      />
      <button
        onClick={() => onSave(parseFloat(score) || 0, parseInt(rank) || 1)}
        className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
      >
        Save
      </button>
    </div>
  )
}
