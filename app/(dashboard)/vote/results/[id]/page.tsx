'use client'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Avatar } from '@/components/shared/Avatar'
import { Trophy, Lock } from 'lucide-react'
import type { CandidateWithProfile, Election } from '@/types/app'

const COLORS = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

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
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{election?.title} — Results</h1>
        <p className="text-slate-500 text-sm mt-1">
          {election?.status === 'closed' ? 'Final vote count' : 'Live preview (admin only)'}
        </p>
      </div>

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
          <section key={position} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">{position}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{total} total votes</p>
            </div>

            {/* Winner */}
            {winner && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
                <div className="relative">
                  <Avatar src={winner.profile.avatar_url} name={winner.profile.full_name} size="lg" />
                  <Trophy size={14} className="absolute -bottom-1 -right-1 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-violet-600 dark:text-violet-300 font-medium uppercase tracking-wide">Winner</p>
                  <p className="font-bold text-slate-900 dark:text-white">{winner.profile.full_name}</p>
                  <p className="text-sm text-slate-500">{winner.votes_count} votes ({total ? Math.round(winner.votes_count / total * 100) : 0}%)</p>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="px-5 py-4">
              <ResponsiveContainer width="100%" height={160}>
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

            {/* Full ranking */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {group.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 text-sm font-bold text-slate-400">#{i + 1}</span>
                  <Avatar src={c.profile.avatar_url} name={c.profile.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.profile.full_name}</p>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-violet-500 h-1.5 rounded-full"
                        style={{ width: `${total ? (c.votes_count / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0">
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
