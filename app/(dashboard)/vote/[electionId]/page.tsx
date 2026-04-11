'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Badge } from '@/components/shared/Badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ShieldX, ShieldCheck } from 'lucide-react'
import { countdown } from '@/lib/utils/formatDate'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateWithProfile, Election } from '@/types/app'

type ElectionWithEligibility = Election & {
  eligible_levels: string[] | null
  require_index_number: boolean
}

export default function VoteBallotPage({ params }: { params: { electionId: string } }) {
  const { electionId } = params
  const { user } = useUser()
  const router = useRouter()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Record<string, string>>({}) // position → candidateId
  const [confirming, setConfirming] = useState(false)

  const { data: election } = useQuery({
    queryKey: ['election', electionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('elections').select('*').eq('id', electionId).single()
      return data as ElectionWithEligibility
    },
  })

  const { data: candidates } = useQuery({
    queryKey: ['candidates', electionId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('candidates')
        .select('*, profile:profiles!user_id(*)')
        .eq('election_id', electionId)
      return (data ?? []) as CandidateWithProfile[]
    },
  })

  const { data: hasVoted } = useQuery({
    queryKey: ['has-voted', electionId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('votes')
        .select('id')
        .eq('election_id', electionId)
        .eq('voter_id', user!.id)
        .maybeSingle()
      return !!data
    },
  })

  const { mutate: castVotes, isPending } = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const entries = Object.entries(selected)
      if (entries.length === 0) throw new Error('Select candidates before voting')
      for (const [, candidateId] of entries) {
        const { error } = await supabase.from('votes').insert({
          election_id: electionId,
          candidate_id: candidateId,
          voter_id: user!.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Vote cast successfully!')
      qc.invalidateQueries({ queryKey: ['has-voted', electionId] })
      router.push('/vote')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Group candidates by position
  const positions = [...new Set(candidates?.map((c) => c.position) ?? [])]

  // Eligibility check
  const eligibilityError = (() => {
    if (!election || !user) return null
    const e = election as ElectionWithEligibility
    if (e.require_index_number && !(user as never as { index_number: string | null }).index_number) {
      return 'You must add your student index number to your profile before voting in this election.'
    }
    if (e.eligible_levels && e.eligible_levels.length > 0) {
      const userLevel = (user as never as { level: string | null }).level
      if (!userLevel || !e.eligible_levels.includes(userLevel)) {
        const readable = e.eligible_levels.map((l) => l === 'postgrad' ? 'Postgrad' : `${l} Level`).join(', ')
        return `This election is restricted to ${readable} students. Your profile level does not match.`
      }
    }
    return null
  })()

  if (eligibilityError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ShieldX size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Not eligible to vote</h2>
        <p className="text-slate-500 text-sm mb-6">{eligibilityError}</p>
        {election && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-violet-500" /> Eligibility requirements
            </p>
            {(election as ElectionWithEligibility).require_index_number && (
              <p className="text-sm text-slate-700 dark:text-slate-300">• Index number must be set in your profile</p>
            )}
            {(election as ElectionWithEligibility).eligible_levels?.length ? (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                • Restricted to: {(election as ElectionWithEligibility).eligible_levels!.map((l) => l === 'postgrad' ? 'Postgrad' : `${l} Level`).join(', ')}
              </p>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  if (hasVoted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">You&apos;ve already voted</h2>
        <p className="text-slate-500 text-sm">Your vote has been recorded. Results will be published when the election closes.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {election && (
        <div>
          {election.banner_url && (
            <img src={election.banner_url} alt="" className="w-full h-40 object-cover rounded-2xl mb-4" />
          )}
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{election.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{countdown(election.ends_at)}</p>
        </div>
      )}

      {positions.map((position) => (
        <section key={position}>
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
            {position}
          </h2>
          <div className="space-y-3">
            {candidates?.filter((c) => c.position === position).map((candidate) => {
              const isSelected = selected[position] === candidate.id
              return (
                <button
                  key={candidate.id}
                  onClick={() => setSelected({ ...selected, [position]: candidate.id })}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300'
                  }`}
                >
                  <Avatar
                    src={candidate.photo_url ?? candidate.profile.avatar_url}
                    name={candidate.profile.full_name}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{candidate.profile.full_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{candidate.manifesto}</p>
                    <Badge variant="info" className="mt-2">Level {candidate.profile.level}</Badge>
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={22} className="text-violet-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {Object.keys(selected).length > 0 && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition"
        >
          Review & Cast Vote
        </button>
      )}

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4 pb-6 md:pb-0">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Confirm your votes</h3>
            <p className="text-sm text-slate-500">This action cannot be undone. You can only vote once per election.</p>
            <div className="space-y-2">
              {Object.entries(selected).map(([position, candidateId]) => {
                const c = candidates?.find((c) => c.id === candidateId)
                return (
                  <div key={position} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                    <Avatar src={c?.profile.avatar_url} name={c?.profile.full_name ?? ''} size="sm" />
                    <div>
                      <p className="text-xs text-slate-500">{position}</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{c?.profile.full_name}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Go back
              </button>
              <button
                onClick={() => castVotes()}
                disabled={isPending}
                className="py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
