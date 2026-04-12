'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { countdown, formatEventDate } from '@/lib/utils/formatDate'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Vote, Clock, ChevronRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import type { Election } from '@/types/app'
import { useLiveCountdown } from '@/lib/hooks/useLiveCountdown'

type ElectionWithEligibility = Election & {
  eligible_levels: string[] | null
  require_index_number: boolean
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

  const active = elections?.filter((e) => e.status === 'active') ?? []
  const upcoming = elections?.filter((e) => e.status === 'draft') ?? []
  const closed = elections?.filter((e) => e.status === 'closed') ?? []

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Elections</h1>
        <p className="text-slate-500 text-sm mt-1">Cast your vote for COSSA leadership</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Active elections */}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Now</h2>
              <div className="space-y-3">
                {active.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            </section>
          )}

          {/* Upcoming elections */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Coming Soon</h2>
              <div className="space-y-3">
                {upcoming.map((e) => <ElectionCard key={e.id} election={e} />)}
              </div>
            </section>
          )}

          {/* Closed elections */}
          {closed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Past Elections</h2>
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
  const isActive = election.status === 'active'
  const isClosed = election.status === 'closed'
  const isUpcoming = election.status === 'draft'
  const liveCountdown = useLiveCountdown(isActive ? election.ends_at : undefined)

  return (
    <Link
      href={isClosed ? `/vote/results/${election.id}` : isUpcoming ? '#' : `/vote/${election.id}`}
      className={cn(
        'block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition group',
        isUpcoming ? 'opacity-70 cursor-default' : 'hover:border-violet-300 dark:hover:border-violet-700'
      )}
    >
      {election.banner_url && (
        <div className="h-28 overflow-hidden">
          <img src={election.banner_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant={isActive ? 'success' : isClosed ? 'default' : 'warning'}>
                {election.status.charAt(0).toUpperCase() + election.status.slice(1)}
              </Badge>
              {election.require_index_number && (
                <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10} /> Index required
                </span>
              )}
              {election.eligible_levels && election.eligible_levels.length > 0 && (
                <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full">
                  {election.eligible_levels.map((l) => l === 'postgrad' ? 'PG' : `${l}L`).join(', ')} only
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{election.title}</h3>
            {election.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{election.description}</p>
            )}
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-violet-600 transition mt-1 shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
          <Clock size={12} />
          {isActive
            ? liveCountdown
            : isClosed
            ? `Ended ${formatEventDate(election.ends_at)}`
            : `Opens ${formatEventDate(election.starts_at)}`}
        </div>
      </div>
    </Link>
  )
}
