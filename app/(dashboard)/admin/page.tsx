import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Vote, Trophy, Megaphone, Tv2, MessageSquare } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { count: userCount },
    { count: electionCount },
    { count: competitionCount },
    { count: announcementCount },
    { count: eventCount },
    { count: channelCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('elections').select('*', { count: 'exact', head: true }),
    supabase.from('competitions').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('channels').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Members',       value: userCount ?? 0,        icon: Users,       href: '/admin/users',         color: 'bg-violet-500' },
    { label: 'Elections',     value: electionCount ?? 0,    icon: Vote,        href: '/admin/elections',     color: 'bg-blue-500' },
    { label: 'Competitions',  value: competitionCount ?? 0, icon: Trophy,      href: '/admin/competitions',  color: 'bg-amber-500' },
    { label: 'Announcements', value: announcementCount ?? 0,icon: Megaphone,   href: '/admin/announcements', color: 'bg-green-500' },
    { label: 'Events',        value: eventCount ?? 0,       icon: Tv2,         href: '/admin/events',        color: 'bg-pink-500' },
    { label: 'Channels',      value: channelCount ?? 0,     icon: MessageSquare,href: '/admin/channels',    color: 'bg-teal-500' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {stats.map(({ label, value, icon: Icon, href, color }) => (
        <Link
          key={label}
          href={href}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-violet-300 dark:hover:border-violet-700 transition"
        >
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
            <Icon size={18} className="text-white" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        </Link>
      ))}
    </div>
  )
}
