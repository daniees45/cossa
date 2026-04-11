'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/shared/Badge'
import { Avatar } from '@/components/shared/Avatar'
import { useUser } from '@/lib/hooks/useUser'
import { useDialog } from '@/components/shared/DialogProvider'
import { toast } from 'sonner'
import { Search, ShieldBan, ShieldCheck, Flag, X, ChevronDown } from 'lucide-react'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Profile } from '@/types/app'

type Role = 'student' | 'admin' | 'super_admin'
type Tab = 'users' | 'reports'

const ROLE_OPTIONS: Role[] = ['student', 'admin', 'super_admin']

type ReportRow = {
  id: string
  reason: string
  note: string | null
  status: 'pending' | 'reviewed' | 'dismissed'
  created_at: string
  post_id: string
  reporter: { full_name: string; username: string; avatar_url: string | null }
  reported_user: { id: string; full_name: string; username: string; avatar_url: string | null; is_banned: boolean }
  post_content: string | null
}

export default function AdminUsersPage() {
  const { user: currentUser } = useUser()
  const { confirm } = useDialog()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('users')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'banned' | 'reported'>('all')
  const [expandedBan, setExpandedBan] = useState<string | null>(null)
  const [banReason, setBanReason] = useState('')

  // ── Users ───────────────────────────────────────────────────────────────────
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as (Profile & { is_banned: boolean; ban_reason: string | null })[]
    },
  })

  // ── Reports ─────────────────────────────────────────────────────────────────
  const { data: reports = [], refetch: refetchReports } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const supabase = createClient()
      // Step 1: get reports + reporter profile
      const { data: rdata } = await supabase
        .from('post_reports' as any)
        .select('id, reason, note, status, created_at, post_id, reporter_id')
        .order('created_at', { ascending: false })
      if (!rdata?.length) return [] as ReportRow[]

      // Step 2: get posts (content)
      const postIds = [...new Set((rdata as any[]).map((r: any) => r.post_id))]
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, author_id')
        .in('id', postIds)

      // Step 3: get all relevant profiles
      const reporterIds = [...new Set((rdata as any[]).map((r: any) => r.reporter_id))]
      const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))]
      const allIds = [...new Set([...reporterIds, ...authorIds])]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', allIds)

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p as any]))
      const postMap    = Object.fromEntries((posts ?? []).map((p) => [p.id, p]))

      return (rdata as any[]).map((r: any) => {
        const post = postMap[r.post_id]
        return {
          id: r.id,
          reason: r.reason,
          note: r.note,
          status: r.status as ReportRow['status'],
          created_at: r.created_at,
          post_id: r.post_id,
          reporter: profileMap[r.reporter_id] ?? { full_name: 'Unknown', username: '?', avatar_url: null, is_banned: false },
          reported_user: post ? profileMap[post.author_id] ?? null : null,
          post_content: post?.content ?? null,
        }
      }).filter((r) => r.reported_user) as ReportRow[]
    },
  })

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: updateRole } = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const supabase = createClient()
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Role updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: () => toast.error('Failed to update role'),
  })

  const { mutate: updateBan } = useMutation({
    mutationFn: async ({ id, is_banned, ban_reason }: { id: string; is_banned: boolean; ban_reason?: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned, ban_reason: is_banned ? (ban_reason ?? null) : null } as any)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { is_banned }) => {
      toast.success(is_banned ? 'User banned' : 'User unbanned')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-reports'] })
      setExpandedBan(null)
      setBanReason('')
    },
    onError: () => toast.error('Failed to update ban status'),
  })

  const { mutate: updateReportStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'reviewed' | 'dismissed' }) => {
      const supabase = createClient()
      const { error } = await supabase.from('post_reports' as any).update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Report updated'); refetchReports() },
    onError: () => toast.error('Failed to update report'),
  })

  const { mutate: deleteReport } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('post_reports' as any).delete().eq('id', id)
    },
    onSuccess: () => { toast.success('Report deleted'); refetchReports() },
  })

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isAdmin      = currentUser?.role === 'admin' || isSuperAdmin

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = (
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.index_number?.toLowerCase().includes(q)
    )
    if (!matchSearch) return false
    if (filter === 'banned') return u.is_banned
    if (filter === 'reported') return reports.some((r) => r.reported_user.id === u.id)
    return true
  })

  const pendingCount = reports.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'users' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Users
            <span className="ml-1.5 text-xs text-slate-400">({users.length})</span>
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${tab === 'reports' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Flag size={13} />
            Reports
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        </div>

        {tab === 'users' && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'banned', 'reported'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === f ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, username, index…"
                className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 w-56"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── USERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Index No.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((user) => (
                  <>
                    <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition ${user.is_banned ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                            <p className="text-xs text-slate-400">@{user.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.index_number ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default">Level {user.level ?? '—'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin && user.id !== currentUser?.id ? (
                          <select
                            value={user.role}
                            onChange={(e) => updateRole({ id: user.id, role: e.target.value as Role })}
                            className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={user.role === 'super_admin' ? 'danger' : user.role === 'admin' ? 'warning' : 'info'}>
                            {user.role}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.is_banned ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full w-fit">
                            <ShieldBan size={10} /> Banned
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Active</span>
                        )}
                      </td>
                      {isAdmin && user.id !== currentUser?.id && (
                        <td className="px-4 py-3">
                          {user.is_banned ? (
                            <button
                              onClick={() => updateBan({ id: user.id, is_banned: false })}
                              className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition"
                            >
                              <ShieldCheck size={12} /> Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => setExpandedBan(expandedBan === user.id ? null : user.id)}
                              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition"
                            >
                              <ShieldBan size={12} /> Ban
                              <ChevronDown size={10} className={expandedBan === user.id ? 'rotate-180' : ''} />
                            </button>
                          )}
                        </td>
                      )}
                      {isAdmin && user.id === currentUser?.id && <td className="px-4 py-3" />}
                    </tr>
                    {expandedBan === user.id && (
                      <tr key={`${user.id}-ban`} className="bg-red-50 dark:bg-red-900/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              value={banReason}
                              onChange={(e) => setBanReason(e.target.value)}
                              placeholder="Reason for ban (optional)"
                              className="flex-1 min-w-48 text-sm bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-red-400"
                            />
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Ban ${user.full_name}?`,
                                  message: 'This user will be blocked from the platform. You can unban them later.',
                                  confirmLabel: 'Ban user',
                                  variant: 'danger',
                                })
                                if (ok) updateBan({ id: user.id, is_banned: true, ban_reason: banReason })
                              }}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition"
                            >
                              Confirm Ban
                            </button>
                            <button
                              onClick={() => { setExpandedBan(null); setBanReason('') }}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ───────────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <Flag size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No reports yet</p>
            </div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden ${r.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : r.status === 'reviewed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                      {r.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 capitalize">{r.reason}</span>
                    <span className="text-xs text-slate-400">{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateReportStatus({ id: r.id, status: 'reviewed' })}
                          className="text-xs font-medium text-green-600 hover:text-green-700 transition"
                        >
                          Mark reviewed
                        </button>
                        <button
                          onClick={() => updateReportStatus({ id: r.id, status: 'dismissed' })}
                          className="text-xs font-medium text-slate-400 hover:text-slate-600 transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete report?', message: 'This report record will be permanently removed.', confirmLabel: 'Delete', variant: 'danger' })
                        if (ok) deleteReport(r.id)
                      }}
                      className="text-slate-300 hover:text-red-500 transition"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Reported post */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Reported Post</p>
                    {r.post_content && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-3 py-2 line-clamp-3">
                        {r.post_content.replace(/<[^>]+>/g, '')}
                      </p>
                    )}
                    {r.note && (
                      <p className="text-xs text-slate-400 mt-1.5 italic">&ldquo;{r.note}&rdquo;</p>
                    )}
                  </div>

                  {/* Users involved */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">People</p>
                    {/* Reported user */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={r.reported_user.avatar_url} name={r.reported_user.full_name} size="sm" />
                        <div>
                          <p className="text-xs font-medium text-slate-900 dark:text-white">{r.reported_user.full_name}</p>
                          <p className="text-[10px] text-slate-400">@{r.reported_user.username} · Reported user</p>
                        </div>
                      </div>
                      {r.reported_user.is_banned ? (
                        <button
                          onClick={() => updateBan({ id: r.reported_user.id, is_banned: false })}
                          className="flex items-center gap-1 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-0.5 rounded-full"
                        >
                          <ShieldCheck size={9} /> Unban
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Ban ${r.reported_user.full_name}?`,
                              message: 'This user will be blocked from the platform.',
                              confirmLabel: 'Ban user',
                              variant: 'danger',
                            })
                            if (ok) updateBan({ id: r.reported_user.id, is_banned: true })
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full hover:bg-red-200 transition"
                        >
                          <ShieldBan size={9} /> Ban
                        </button>
                      )}
                    </div>
                    {/* Reporter */}
                    <div className="flex items-center gap-2">
                      <Avatar src={r.reporter.avatar_url} name={r.reporter.full_name} size="sm" />
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{r.reporter.full_name}</p>
                        <p className="text-[10px] text-slate-400">@{r.reporter.username} · Reporter</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

