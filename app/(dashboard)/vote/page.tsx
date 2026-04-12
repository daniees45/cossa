'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { countdown, formatEventDate } from '@/lib/utils/formatDate'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Vote, Clock, ChevronRight, ShieldCheck, Sparkles, CheckCircle2, CalendarClock, Archive } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { Election } from '@/types/app'
import { useLiveCountdown } from '@/lib/hooks/useLiveCountdown'

type ElectionWithEligibility = Election & {
  eligible_levels: string[] | null
  require_index_number: boolean
}

type RuntimeElectionStatus = 'draft' | 'active' | 'closed'

function deriveElectionStatus(startsAt: string, endsAt: string): RuntimeElectionStatus {
  const now = Date.now()
  const starts = new Date(startsAt).getTime()
  const ends = new Date(endsAt).getTime()
  if (now < starts) return 'draft'
  if (now >= ends) return 'closed'
  return 'active'
}

export default function VotePage() {
  const { data: elections, isLoading } = useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('elections')
        .select('*')
        .order('starts_at', { ascending: false })
      return (data ?? []) as ElectionWithEligibility[]
    },
  })

  const active = elections?.filter((e) => deriveElectionStatus(e.starts_at, e.ends_at) === 'active') ?? []
  const upcoming = elections?.filter((e) => deriveElectionStatus(e.starts_at, e.ends_at) === 'draft') ?? []
  const closed = elections?.filter((e) => deriveElectionStatus(e.starts_at, e.ends_at) === 'closed') ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-3 py-4 sm:px-4 sm:py-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-slate-700/70 dark:bg-[linear-gradient(140deg,rgba(15,23,42,0.95),rgba(6,78,59,0.45))] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700/80 dark:text-emerald-300/80">Student Elections</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Vote with clarity and confidence.</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Browse live ballots, preview upcoming races, and review completed outcomes in one modern voting hub.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-slate-900/70 dark:text-emerald-300">
            <Sparkles size={13} /> Secure ballot flow
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-2 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{active.length}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Live</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{upcoming.length}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Upcoming</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{closed.length}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Closed</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[1.6rem] bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active now</h2>
              </div>
              <div className="space-y-3">
                {active.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock size={14} className="text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coming soon</h2>
              </div>
              <div className="space-y-3">
                {upcoming.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Archive size={14} className="text-slate-500" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Past elections</h2>
              </div>
              <div className="space-y-3">
                {closed.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            </section>
          )}

          {elections?.length === 0 && (
            <EmptyState
              icon={<Vote size={24} />}
              title="No elections yet"
              description="Check back when an election is announced by COSSA admin."
            />
          )}
        </>
      )}
    </div>
  )
}

function ElectionCard({ election }: { election: ElectionWithEligibility }) {
  const runtimeStatus = deriveElectionStatus(election.starts_at, election.ends_at)
  const isActive = runtimeStatus === 'active'
  const isClosed = runtimeStatus === 'closed'
  const isUpcoming = runtimeStatus === 'draft'
  const liveCountdown = useLiveCountdown(isActive ? election.ends_at : undefined)

  return (
    <Link
      href={isClosed ? `/vote/results/${election.id}` : isUpcoming ? '#' : `/vote/${election.id}`}
      aria-disabled={isUpcoming}
      onClick={(event) => {
        if (isUpcoming) event.preventDefault()
      }}
      className={cn(
        'block overflow-hidden rounded-[1.5rem] border bg-white/95 transition dark:bg-slate-800/95',
        isUpcoming
          ? 'cursor-default border-slate-200/80 opacity-80 dark:border-slate-700/80'
          : 'border-slate-200/80 shadow-[0_10px_28px_rgba(15,23,42,0.07)] hover:-translate-y-[1px] hover:border-emerald-300 dark:border-slate-700/80 dark:hover:border-emerald-700',
      )}
    >
      {election.banner_url && (
        <div className="relative h-32 overflow-hidden">
          <img src={election.banner_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant={isActive ? 'success' : isClosed ? 'default' : 'warning'}>
                {runtimeStatus.charAt(0).toUpperCase() + runtimeStatus.slice(1)}
              </Badge>
              {election.require_index_number && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <ShieldCheck size={10} /> Index required
                </span>
              )}
              {election.eligible_levels && election.eligible_levels.length > 0 && (
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                  {election.eligible_levels.map((l) => l === 'postgrad' ? 'PG' : `${l}L`).join(', ')} only
                </span>
              )}
            </div>

            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{election.title}</h3>
            {election.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-300">{election.description}</p>
            )}
          </div>

          <ChevronRight size={18} className={cn('mt-0.5 shrink-0 transition', isUpcoming ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 group-hover:text-emerald-600')} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-700">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} />
            {isActive
              ? liveCountdown
              : isClosed
              ? `Ended ${formatEventDate(election.ends_at)}`
              : `Opens ${formatEventDate(election.starts_at)}`}
          </span>
          <span className={cn('font-semibold', isActive ? 'text-emerald-600 dark:text-emerald-300' : isClosed ? 'text-slate-500 dark:text-slate-400' : 'text-cyan-700 dark:text-cyan-300')}>
            {isClosed ? 'View results' : isUpcoming ? 'Not started' : 'Open ballot'}
          </span>
        </div>
      </div>
    </Link>
  )
}
