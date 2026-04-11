'use client'
import { use, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/shared/Badge'
import { countdown, formatEventDate } from '@/lib/utils/formatDate'
import { Trophy, Clock, ExternalLink, GitBranch, Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Competition, Submission } from '@/types/app'
import { useState } from 'react'
import Link from 'next/link'

const submitSchema = z.object({
  team_name: z.string().optional(),
  repo_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  demo_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  description: z.string().max(500, 'Max 500 characters').optional(),
})
type SubmitForm = z.infer<typeof submitSchema>

export default function CompetitionDetailPage({ params }: { params: Promise<{ competitionId: string }> }) {
  const { competitionId } = use(params)
  const { user } = useUser()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'details' | 'leaderboard' | 'submit'>('details')

  const { data: competition } = useQuery({
    queryKey: ['competition', competitionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('competitions').select('*').eq('id', competitionId).single()
      return data as Competition
    },
  })

  const { data: submissions } = useQuery({
    queryKey: ['submissions', competitionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('competition_submissions')
        .select('*, submitter:profiles!submitter_id(full_name, username, avatar_url)')
        .eq('competition_id', competitionId)
        .order('rank', { ascending: true, nullsFirst: false })
        .order('submitted_at', { ascending: true })
      return (data ?? []) as unknown as (Submission & { submitter: { full_name: string; username: string; avatar_url: string | null } })[]
    },
  })

  const mySubmission = submissions?.find((s) => s.submitter_id === user?.id)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmitForm>({ resolver: zodResolver(submitSchema) })

  // Pre-populate form when existing submission is loaded
  useEffect(() => {
    if (mySubmission) {
      reset({
        team_name: mySubmission.team_name ?? '',
        repo_url: mySubmission.repo_url ?? '',
        demo_url: mySubmission.demo_url ?? '',
        description: mySubmission.description ?? '',
      })
    }
  }, [mySubmission, reset])

  const { mutate: submit } = useMutation({
    mutationFn: async (data: SubmitForm) => {
      const supabase = createClient()
      const { error } = await supabase.from('competition_submissions').upsert({
        competition_id: competitionId,
        submitter_id: user!.id,
        team_name: data.team_name || null,
        repo_url: data.repo_url || null,
        demo_url: data.demo_url || null,
        description: data.description || null,
      }, { onConflict: 'competition_id,submitter_id' })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Submission saved!')
      qc.invalidateQueries({ queryKey: ['submissions', competitionId] })
      setTab('leaderboard')
    },
    onError: () => toast.error('Submission failed'),
  })

  if (!competition) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={competition.status === 'active' ? 'success' : competition.status === 'upcoming' ? 'warning' : 'default'}>
            {competition.status}
          </Badge>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{competition.title}</h1>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {competition.status === 'active'
              ? countdown(competition.ends_at)
              : competition.status === 'upcoming'
              ? `Starts ${formatEventDate(competition.starts_at)}`
              : `Ended ${formatEventDate(competition.ends_at)}`}
          </span>
          {competition.max_team_size > 1 && (
            <span className="flex items-center gap-1"><Users size={12} /> Team of up to {competition.max_team_size}</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
        {(['details', 'leaderboard', ...(competition.status === 'active' ? ['submit'] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as never)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* DETAILS */}
      {tab === 'details' && (
        <div className="space-y-4">
          {competition.description && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{competition.description}</p>
            </div>
          )}
          {competition.rules && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Rules</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{competition.rules}</p>
            </div>
          )}
          {competition.prizes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-amber-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Prizes</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{competition.prizes}</p>
            </div>
          )}
        </div>
      )}

      {/* LEADERBOARD */}
      {tab === 'leaderboard' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">
              {submissions?.length ?? 0} submission{submissions?.length !== 1 ? 's' : ''}
            </p>
          </div>
          {submissions?.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No submissions yet</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {submissions?.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 text-sm font-bold text-slate-400 shrink-0">
                    {s.rank ?? `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {s.team_name ?? s.submitter.full_name}
                    </p>
                    {s.repo_url && (
                      <a
                        href={s.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-violet-600 hover:underline mt-0.5"
                      >
                        <GitBranch size={11} /> Repository
                      </a>
                    )}
                  </div>
                  {s.score != null && (
                    <span className="text-sm font-bold text-violet-600 shrink-0">{s.score} pts</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBMIT */}
      {tab === 'submit' && user && (
        <form onSubmit={handleSubmit((d) => submit(d))} className="space-y-4">
          {mySubmission && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-sm text-green-700 dark:text-green-400">
              You already have a submission. Fill the form to update it.
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Team Name (optional)</label>
            <input
              {...register('team_name')}
              placeholder="Team Alpha"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Repository URL</label>
            <input
              {...register('repo_url')}
              placeholder="https://github.com/…"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.repo_url && <p className="text-red-400 text-xs mt-1">{errors.repo_url.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">Demo URL (optional)</label>
            <input
              {...register('demo_url')}
              placeholder="https://your-demo.vercel.app"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.demo_url && <p className="text-red-400 text-xs mt-1">{errors.demo_url.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
              Description <span className="text-slate-400">(max 500 chars)</span>
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Describe your project…"
              className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {mySubmission ? 'Update Submission' : 'Submit Project'}
          </button>
        </form>
      )}
    </div>
  )
}
