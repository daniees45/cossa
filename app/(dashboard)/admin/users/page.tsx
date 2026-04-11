import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/shared/Badge'
import type { Profile } from '@/types/app'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-900 dark:text-white text-lg">Members</h2>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Index No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(users ?? []).map((user: Profile) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{user.full_name}</p>
                      <p className="text-xs text-slate-400">@{user.username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.index_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="default">Level {user.level ?? '—'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'super_admin' ? 'danger' : user.role === 'admin' ? 'warning' : 'info'}>
                      {user.role}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
