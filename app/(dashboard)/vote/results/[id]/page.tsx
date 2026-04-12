'use client'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Avatar } from '@/components/shared/Avatar'
import { Trophy, Lock, BarChart3 } from 'lucide-react'
import type { CandidateWithProfile, Election } from '@/types/app'

const COLORS = ['#0f766e', '#0ea5a4', '#22c55e', '#14b8a6', '#2dd4bf']

export default function ElectionResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useUser()
  const isAdmin = !!(user && ['admin', 'super_admin'].includes((user as unknown as { role?: string }).role ?? ''))

  const { data: election } = useQuery({
    queryKey: ['election', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('elections').select('*').eq('id', id).single()
      return data as Election
    },
  })

  const { data: candidates } = useQuery({
    queryKey: ['candidates-results', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('candidates')
        .select('*, profile:profiles!user_id(*)')
        .eq('election_id', id)
        .order('votes_count', { ascending: false })
      return (data ?? []) as unknown as CandidateWithProfile[]
    },
  })

  const positions = [...new Set(candidates?.map((c) => c.position) ?? [])]

  if (election && election.status !== 'closed' && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-16 sm:py-20 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Lock size={24} className="text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Results Not Available Yet</h1>
        <p className="text-slate-500 text-sm max-w-xs">
          Results will be published once this election is officially closed.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
      <section className="overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-slate-700/70 dark:bg-[linear-gradient(140deg,rgba(15,23,42,0.95),rgba(6,78,59,0.45))] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">Election Results</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{election?.title}</h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              {election?.status === 'closed' ? 'Final vote count' : 'Live preview (admin only)'}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:bg-slate-900/70 dark:text-emerald-300">
            <BarChart3 size={12} />
            {positions.length} position{positions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </section>

      {positions.map((position) => {
        const group = candidates?.filter((c) => c.position === position) ?? []
        const winner = group[0]
        const total = group.reduce((s, c) => s + c.votes_count, 0)
        const chartData = group.map((c) => ({
          name: c.profile.full_name.split(' ')[0],
          votes: c.votes_count,
          pct: total ? Math.round((c.votes_count / total) * 100) : 0,
        }))

        return (
          <section key={position} className="overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white/95 shadow-[0_14px_32px_rgba(15,23,42,0.07)] dark:border-slate-700/80 dark:bg-slate-800/95">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">{position}</h2>
              <p className="mt-0.5 text-xs text-slate-400">{total} total votes</p>
            </div>

            {winner && (
              <div className="flex flex-col gap-4 border-b border-emerald-100 bg-emerald-50/80 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-900/20 sm:flex-row sm:items-center">
                <div className="relative">
                  <Avatar src={winner.profile.avatar_url} name={winner.profile.full_name} size="lg" />
                  <Trophy size={14} className="absolute -bottom-1 -right-1 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Winner</p>
                  <p className="font-bold text-slate-900 dark:text-white">{winner.profile.full_name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{winner.votes_count} votes ({total ? Math.round(winner.votes_count / total * 100) : 0}%)</p>
                </div>
              </div>
            )}

            <div className="px-5 py-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [value + ' votes', name]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                  />
                  <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {group.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-sm font-bold text-slate-400">#{i + 1}</span>
                  <Avatar src={c.profile.avatar_url} name={c.profile.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{c.profile.full_name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500"
                        style={{ width: `${total ? (c.votes_count / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {total ? Math.round(c.votes_count / total * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
