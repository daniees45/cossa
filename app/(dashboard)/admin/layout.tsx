import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/competitions', label: 'Competitions' },
  { href: '/admin/elections', label: 'Elections' },
  { href: '/admin/channels', label: 'Channels' },
  { href: '/admin/resources', label: 'Resources' },
  { href: '/admin/users', label: 'Users' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div>
      {/* Admin top nav */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}
