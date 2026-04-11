'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Trophy, Clock, ExternalLink } from 'lucide-react'
import { countdown, formatEventDate } from '@/lib/utils/formatDate'
import Link from 'next/link'
import type { Competition } from '@/types/app'
import { cn } from '@/lib/utils/cn'

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  upcoming: 'warning',
  active: 'success',
  ended: 'default',
}
const typeLabel: Record<string, string> = {
  hackathon: '🏗️ Hackathon',
  quiz: '❓ Quiz',
  coding_challenge: '💻 Coding',
}

export default function CompetePage() {
  const { data: competitions, isLoading } = useQuery({
    queryKey: ['competitions'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('competitions')
        .select('*')
        .order('starts_at', { ascending: false })
      return (data ?? []) as Competition[]
    },
  })

  const active = competitions?.filter((c) => c.status === 'active') ?? []
  const upcoming = competitions?.filter((c) => c.status === 'upcoming') ?? []
  const ended = competitions?.filter((c) => c.status === 'ended') ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Competitions</h1>
        <p className="text-slate-500 text-sm mt-1">Hackathons, quizzes, and coding challenges</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : competitions?.length === 0 ? (
        <EmptyState icon={<Trophy size={22} />} title="No competitions yet" description="Check back when an event is announced." />
      ) : (
        <>
          {active.length > 0 && (
            <CompSection title="🔥 Live Now" items={active} />
          )}
          {upcoming.length > 0 && (
            <CompSection title="Upcoming" items={upcoming} />
          )}
          {ended.length > 0 && (
            <CompSection title="Past Competitions" items={ended} />
          )}
        </>
      )}
    </div>
  )
}

function CompSection({ title, items }: { title: string; items: Competition[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-4">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/compete/${c.id}`}
            className="block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-violet-300 dark:hover:border-violet-700 transition"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={statusVariant[c.status]}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </Badge>
                  <span className="text-xs text-slate-400">{typeLabel[c.type] ?? c.type}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">{c.title}</h3>
              </div>
              <ExternalLink size={14} className="text-slate-400 shrink-0 mt-1" />
            </div>
            {c.description && (
              <p className="text-sm text-slate-500 line-clamp-2 mb-3">{c.description}</p>
            )}
            {c.prizes && (
              <div className="flex items-center gap-1.5 mb-3">
                <Trophy size={13} className="text-amber-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">{c.prizes}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              {c.status === 'active'
                ? countdown(c.ends_at)
                : c.status === 'upcoming'
                ? `Starts ${formatEventDate(c.starts_at)}`
                : `Ended ${formatEventDate(c.ends_at)}`}
              {c.max_team_size > 1 && (
                <span className="ml-2">· Team of {c.max_team_size}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
