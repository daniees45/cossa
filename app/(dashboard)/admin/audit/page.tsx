'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared/EmptyState'
import { ScrollText } from 'lucide-react'
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
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('admin_audit_logs')
        .select('id, action, target_type, target_id, details, created_at, actor:profiles!admin_id(full_name, username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(200)
      return (data ?? []) as unknown as AuditLogRow[]
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Admin Audit Logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Track role, moderation, and report actions</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} />} title="No audit logs yet" description="Admin actions will appear here." />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
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
