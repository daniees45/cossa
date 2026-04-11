'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { countdown, formatEventDate } from '@/lib/utils/formatDate'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Vote, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { Election } from '@/types/app'

export default function VotePage() {
  const { data: elections, isLoading } = useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('elections')
        .select('*')
        .neq('status', 'draft')
        .order('starts_at', { ascending: false })
      return (data ?? []) as Election[]
    },
  })

  const active = elections?.filter((e) => e.status === 'active') ?? []
  const closed = elections?.filter((e) => e.status === 'closed') ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
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

function ElectionCard({ election }: { election: Election }) {
  const isActive = election.status === 'active'
  const isClosed = election.status === 'closed'

  return (
    <Link
      href={isClosed ? `/vote/results/${election.id}` : `/vote/${election.id}`}
      className="block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-violet-300 dark:hover:border-violet-700 transition group"
    >
      {election.banner_url && (
        <div className="h-28 overflow-hidden">
          <img src={election.banner_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isActive ? 'success' : isClosed ? 'default' : 'warning'}>
                {election.status.charAt(0).toUpperCase() + election.status.slice(1)}
              </Badge>
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
            ? countdown(election.ends_at)
            : `Ended ${formatEventDate(election.ends_at)}`}
        </div>
      </div>
    </Link>
  )
}
