'use client'
import { use, useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Badge } from '@/components/shared/Badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ShieldX, ShieldCheck, X, FileText, Clock, KeyRound, AlertCircle } from 'lucide-react'
import { useLiveCountdown } from '@/lib/hooks/useLiveCountdown'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import type { CandidateWithProfile, Election } from '@/types/app'

type ElectionWithEligibility = Election & {
  eligible_levels: string[] | null
  require_index_number: boolean
}

type VoteReceipt = {
  id: string
  receipt_code: string
  created_at: string
}

export default function VoteBallotPage({ params }: { params: Promise<{ electionId: string }> }) {
  const { electionId } = use(params)
  const { user } = useUser()
  const router = useRouter()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [manifestoCandidate, setManifestoCandidate] = useState<CandidateWithProfile | null>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  // Voter roll verification state
  const [studentId, setStudentId] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [justVerified, setJustVerified] = useState(false)

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
      return (data ?? []) as unknown as CandidateWithProfile[]
    },
  })

  const { data: voteReceipt } = useQuery({
    queryKey: ['vote-receipt', electionId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('election_vote_receipts')
        .select('id, receipt_code, created_at')
        .eq('election_id', electionId)
        .eq('voter_id', user!.id)
        .maybeSingle()
      return (data ?? null) as VoteReceipt | null
    },
  })
  const hasVoted = !!voteReceipt

  // Voter roll: does this election require voter-roll verification?
  const { data: rollCount } = useQuery({
    queryKey: ['voter-roll-count', electionId],
    enabled: !!electionId,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_voter_roll_count', { p_election_id: electionId })
      return (data as number) ?? 0
    },
  })

  // Is current user already verified (voter_id set in voter_rolls for this election)?
  const { data: preVerified } = useQuery({
    queryKey: ['voter-pre-verified', electionId, user?.id],
    enabled: !!user && !!electionId,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('voter_rolls')
        .select('id')
        .eq('election_id', electionId)
        .eq('voter_id', user!.id)
        .maybeSingle()
      return !!data
    },
  })

  const liveCountdown = useLiveCountdown(election?.ends_at)

  // Voter roll logic
  const hasVoterRoll = (rollCount ?? 0) > 0
  const needsVerification = hasVoterRoll && !preVerified && !justVerified

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !studentId.trim()) return
    setVerifying(true)
    setVerifyError('')
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('verify_voter', {
        p_election_id: electionId,
        p_student_id:  studentId.toUpperCase().trim(),
      })
      if (error) { setVerifyError(error.message); return }
      const result = data as { ok: boolean; error?: string; student_id?: string }
      if (!result.ok) { setVerifyError(result.error ?? 'Verification failed'); return }
      setJustVerified(true)
      toast.success(`Student ID ${result.student_id ?? studentId.toUpperCase().trim()} verified`)
    } finally {
      setVerifying(false)
    }
  }

  const { mutate: castVotes, isPending } = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const candidateIds = Object.values(selected)
      if (candidateIds.length === 0) throw new Error('Select candidates before voting')
      const { data, error } = await supabase.rpc('cast_ballot', {
        p_election_id: electionId,
        p_candidate_ids: candidateIds,
      })
      if (error) throw error
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Could not cast vote')
    },
    onSuccess: () => {
      toast.success('Vote cast successfully!')
      qc.invalidateQueries({ queryKey: ['vote-receipt', electionId] })
      router.push('/vote')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Group candidates by position
  const positions = [...new Set(candidates?.map((c) => c.position) ?? [])]
  const totalPositions = positions.length
  const selectedCount = Object.keys(selected).length

  // Eligibility check
  const eligibilityError = (() => {
    if (!election || !user) return null
    const e = election as ElectionWithEligibility
    if (e.require_index_number && !(user as unknown as { index_number: string | null }).index_number) {
      return 'You must add your student index number to your profile before voting in this election.'
    }
    if (e.eligible_levels && e.eligible_levels.length > 0) {
      const userLevel = (user as unknown as { level: string | null }).level
      if (!userLevel || !e.eligible_levels.includes(userLevel)) {
        const readable = e.eligible_levels.map((l) => l === 'postgrad' ? 'Postgrad' : `${l} Level`).join(', ')
        return `This election is restricted to ${readable} students. Your profile level does not match.`
      }
    }
    return null
  })()

  // ── Voter roll verification gate ────────────────────────────────────────────
  if (needsVerification && rollCount !== undefined && preVerified !== undefined) {
    return (
      <div className="max-w-md mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
            <KeyRound size={26} className="text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Verify your identity</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            This election requires a student ID verification before you can access the ballot.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          {election && (
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              {election.banner_url && (
                <img src={election.banner_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{election.title}</p>
                <p className="text-xs text-slate-400">{liveCountdown}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Student ID
              </label>
              <input
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setVerifyError('') }}
                placeholder="e.g. CS/2020/001 or 10201234"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500 uppercase placeholder:uppercase placeholder:opacity-40"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Use the student ID that appears on your school voter list.
              </p>
            </div>

            {verifyError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{verifyError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || !studentId.trim()}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              {verifying && <Loader2 size={15} className="animate-spin" />}
              {verifying ? 'Verifying…' : 'Verify & Access Ballot'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          If your student ID is not on the voter list, contact the election admin.
        </p>
      </div>
    )
  }

  if (eligibilityError) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-12 sm:py-16 text-center">
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
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-8 sm:py-10 space-y-6">
        <div className="text-center">
          <CheckCircle2 size={52} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">You&apos;ve already voted</h2>
          <p className="text-slate-500 text-sm">Your vote has been securely recorded.</p>
        </div>

        {voteReceipt && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Anonymous vote receipt</p>
              <p className="text-xs text-slate-400 mt-0.5">Your participation proof is stored separately from ballot selections.</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Receipt code</p>
                <p className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{voteReceipt.receipt_code}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Recorded</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(voteReceipt.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/vote"
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Back to Elections
          </Link>
          <Link
            href={`/vote/results/${electionId}`}
            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold text-center transition"
          >
            View Results
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 pb-10 space-y-6">
      {/* Election header */}
      {election && (
        <div className="pt-6">
          {election.banner_url && (
            <img src={election.banner_url} alt="" className="w-full h-40 object-cover rounded-2xl mb-4" />
          )}
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{election.title}</h1>
          {election.description && (
            <p className="text-sm text-slate-500 mt-1">{election.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
            <Clock size={12} />
            {liveCountdown}
          </div>
        </div>
      )}

      {/* Position navigation pills — shown when there are multiple positions */}
      {positions.length > 1 && (
        <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {positions.map((p) => (
              <button
                key={p}
                onClick={() => sectionRefs.current.get(p)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition',
                  selected[p]
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {selected[p] ? '✓ ' : ''}{p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Positions */}
      {positions.map((position) => (
        <section
          key={position}
          ref={(el) => { if (el) sectionRefs.current.set(position, el) }}
        >
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
                  className={cn(
                    'w-full text-left flex flex-col sm:flex-row items-start gap-4 p-4 rounded-2xl border-2 transition',
                    isSelected
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300'
                  )}
                >
                  <Avatar
                    src={candidate.photo_url ?? candidate.profile.avatar_url}
                    name={candidate.profile.full_name}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{candidate.profile.full_name}</p>
                    <Badge variant="info" className="mt-1 mb-2">Level {candidate.profile.level}</Badge>
                    {candidate.manifesto && (
                      <p className="text-xs text-slate-500 line-clamp-2">{candidate.manifesto}</p>
                    )}
                    {candidate.manifesto && candidate.manifesto.length > 100 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setManifestoCandidate(candidate) }}
                        className="flex items-center gap-1 mt-1.5 text-xs text-violet-600 hover:text-violet-500 font-medium"
                      >
                        <FileText size={11} /> Read full manifesto
                      </button>
                    )}
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={22} className="text-violet-600 shrink-0 mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {/* Progress bar + submit */}
      {totalPositions > 0 && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-500">{selectedCount} of {totalPositions} positions selected</p>
              {selectedCount === totalPositions && (
                <p className="text-xs text-green-600 font-medium">Ready to submit!</p>
              )}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  selectedCount === totalPositions ? 'bg-green-500' : 'bg-violet-500'
                )}
                style={{ width: `${totalPositions ? (selectedCount / totalPositions) * 100 : 0}%` }}
              />
            </div>
          </div>

          {selectedCount > 0 && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition"
            >
              {selectedCount < totalPositions
                ? `Continue (${selectedCount}/${totalPositions} selected)`
                : 'Review & Cast Vote'}
            </button>
          )}
        </div>
      )}

      {/* Confirmation modal */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Full manifesto modal */}
      {manifestoCandidate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-3 sm:px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <Avatar
                src={manifestoCandidate.photo_url ?? manifestoCandidate.profile.avatar_url}
                name={manifestoCandidate.profile.full_name}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{manifestoCandidate.profile.full_name}</p>
                <p className="text-xs text-slate-500">{manifestoCandidate.position}</p>
              </div>
              <button
                onClick={() => setManifestoCandidate(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-80 overflow-y-auto">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {manifestoCandidate.manifesto}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => {
                  setSelected({ ...selected, [manifestoCandidate.position]: manifestoCandidate.id })
                  setManifestoCandidate(null)
                }}
                className={cn(
                  'w-full py-2.5 rounded-xl text-sm font-semibold transition',
                  selected[manifestoCandidate.position] === manifestoCandidate.id
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 cursor-default'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                )}
              >
                {selected[manifestoCandidate.position] === manifestoCandidate.id
                  ? '✓ Selected'
                  : `Vote for ${manifestoCandidate.profile.full_name.split(' ')[0]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
