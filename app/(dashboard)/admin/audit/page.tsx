'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared/EmptyState'
import { ScrollText, Download, Search } from 'lucide-react'
import { timeAgo, formatDate } from '@/lib/utils/formatDate'

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor: { full_name: string; username: string; avatar_url: string | null } | null
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('admin_audit_logs')
        .select('id, action, target_type, target_id, details, created_at, actor:profiles!admin_id(full_name, username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(1000)
      return (data ?? []) as unknown as AuditLogRow[]
    },
  })

  const actions = useMemo(() => ['all', ...Array.from(new Set(logs.map((l) => l.action)))], [logs])
  const actors = useMemo(
    () => ['all', ...Array.from(new Set(logs.map((l) => l.actor?.username).filter(Boolean) as string[]))],
    [logs],
  )

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false
      if (actorFilter !== 'all' && log.actor?.username !== actorFilter) return false

      const created = new Date(log.created_at)
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`)
        if (created < from) return false
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`)
        if (created > to) return false
      }

      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        log.action.toLowerCase().includes(q) ||
        log.target_type.toLowerCase().includes(q) ||
        (log.target_id ?? '').toLowerCase().includes(q) ||
        (log.actor?.full_name ?? '').toLowerCase().includes(q) ||
        (log.actor?.username ?? '').toLowerCase().includes(q) ||
        JSON.stringify(log.details ?? {}).toLowerCase().includes(q)
      )
    })
  }, [logs, actionFilter, actorFilter, dateFrom, dateTo, search])

  function exportCsv() {
    if (filteredLogs.length === 0) return
    const headers = ['created_at', 'actor_full_name', 'actor_username', 'action', 'target_type', 'target_id', 'details_json']
    const rows = filteredLogs.map((l) => [
      l.created_at,
      l.actor?.full_name ?? '',
      l.actor?.username ?? '',
      l.action,
      l.target_type,
      l.target_id ?? '',
      JSON.stringify(l.details ?? {}),
    ])

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map((c) => escape(String(c))).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Admin Audit Logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Track role, moderation, and report actions</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, target, details..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
          >
            <Download size={14} />
            CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
          >
            {actions.map((a) => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
          </select>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
          >
            {actors.map((a) => <option key={a} value={a}>{a === 'all' ? 'All actors' : `@${a}`}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
          />
        </div>
        <p className="text-xs text-slate-400">Showing {filteredLogs.length} of {logs.length} logs</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} />} title="No audit logs yet" description="Admin actions will appear here." />
      ) : filteredLogs.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} />} title="No matching logs" description="Adjust your filters or search query." />
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar src={log.actor?.avatar_url ?? null} name={log.actor?.full_name ?? 'Admin'} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {log.actor?.full_name ?? 'Admin'}
                      <span className="text-slate-400 font-normal"> @{log.actor?.username ?? 'unknown'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.action} on {log.target_type}
                      {log.target_id ? ` (${log.target_id.slice(0, 8)}...)` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">{timeAgo(log.created_at)}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(log.created_at)}</p>
                </div>
              </div>
              {log.details && Object.keys(log.details).length > 0 && (
                <pre className="mt-2 text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900/60 rounded-lg px-2.5 py-2 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
