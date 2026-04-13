import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  Users,
  Vote,
  Trophy,
  Megaphone,
  Tv2,
  MessageSquare,
  Bell,
  Image as ImageIcon,
  Shield,
  ArrowRight,
  Activity,
  Palette,
} from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { count: userCount },
    { count: electionCount },
    { count: competitionCount },
    { count: announcementCount },
    { count: eventCount },
    { count: channelCount },
    { count: pendingReportsCount },
    { count: pendingJoinRequestsCount },
    { count: unreadNotificationsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('elections').select('*', { count: 'exact', head: true }),
    supabase.from('competitions').select('*', { count: 'exact', head: true }),
    supabase.from('announcements').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('channels').select('*', { count: 'exact', head: true }),
    supabase.from('post_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('channel_join_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false),
  ])

  const stats = [
    {
      label: 'Members',
      value: userCount ?? 0,
      icon: Users,
      href: '/admin/users',
      tone: 'from-violet-500/20 to-fuchsia-500/10 text-violet-600 dark:text-violet-300',
    },
    {
      label: 'Elections',
      value: electionCount ?? 0,
      icon: Vote,
      href: '/admin/elections',
      tone: 'from-blue-500/20 to-cyan-500/10 text-blue-600 dark:text-blue-300',
    },
    {
      label: 'Competitions',
      value: competitionCount ?? 0,
      icon: Trophy,
      href: '/admin/competitions',
      tone: 'from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-300',
    },
    {
      label: 'Announcements',
      value: announcementCount ?? 0,
      icon: Megaphone,
      href: '/admin/announcements',
      tone: 'from-emerald-500/20 to-green-500/10 text-emerald-600 dark:text-emerald-300',
    },
    {
      label: 'Events',
      value: eventCount ?? 0,
      icon: Tv2,
      href: '/admin/events',
      tone: 'from-rose-500/20 to-pink-500/10 text-rose-600 dark:text-rose-300',
    },
    {
      label: 'Channels',
      value: channelCount ?? 0,
      icon: MessageSquare,
      href: '/admin/channels',
      tone: 'from-teal-500/20 to-emerald-500/10 text-teal-600 dark:text-teal-300',
    },
  ]

  const signalCards = [
    {
      label: 'Pending Reports',
      value: pendingReportsCount ?? 0,
      href: '/admin/users',
      icon: Shield,
      note: 'Moderation queue',
    },
    {
      label: 'Join Requests',
      value: pendingJoinRequestsCount ?? 0,
      href: '/admin/channels',
      icon: Activity,
      note: 'Private channels',
    },
    {
      label: 'Unread Alerts',
      value: unreadNotificationsCount ?? 0,
      href: '/admin/notifications',
      icon: Bell,
      note: 'Broadcast center',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.15),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(217,70,239,0.14),transparent_40%),linear-gradient(120deg,rgba(2,6,23,0.04),transparent)]" />
        <div className="relative p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div>
            <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Shield size={12} /> Admin Control Room
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              COSSA Operations Dashboard
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl">
              Review platform health, moderation pressure, and publishing pipelines at a glance.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[310px]">
            {signalCards.map(({ label, value, href, icon: Icon, note }) => (
              <Link
                key={label}
                href={href}
                className="col-span-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-3 hover:border-violet-300 dark:hover:border-violet-700 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
                    <p className="text-[11px] text-slate-400">{note}</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                    <Icon size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, href, tone }) => (
          <Link
            key={label}
            href={href}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:shadow-lg hover:shadow-slate-900/5 dark:hover:shadow-black/20 transition"
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br ${tone}`} />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">{value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform">
                <Icon size={18} />
              </div>
            </div>
            <div className="relative mt-4 flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-300">
              Open module <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Launch</h2>
          <p className="text-xs text-slate-400 mt-0.5">Most used admin actions</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <QuickAction href="/admin/announcements" icon={Megaphone} label="Post Announcement" description="Send campus-wide update" />
            <QuickAction href="/admin/notifications" icon={Bell} label="Broadcast Alert" description="Targeted push notice" />
            <QuickAction href="/admin/channels" icon={MessageSquare} label="Manage Channels" description="Moderate access and members" />
            <QuickAction href="/admin/gallery" icon={ImageIcon} label="Update Gallery" description="Upload event media" />
            <QuickAction href="/admin/appearance" icon={Palette} label="Edit Branding" description="Logo, title, and backgrounds" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Operational Snapshot</h2>
          <p className="text-xs text-slate-400 mt-0.5">Current focus areas</p>
          <div className="mt-3 space-y-2 text-sm">
            <SnapshotRow label="Community size" value={`${userCount ?? 0} members`} />
            <SnapshotRow label="Active content channels" value={`${channelCount ?? 0} channels`} />
            <SnapshotRow label="Elections configured" value={`${electionCount ?? 0} ballots`} />
            <SnapshotRow label="Pending moderation" value={`${pendingReportsCount ?? 0} reports`} tone="warn" />
            <SnapshotRow label="Private join queue" value={`${pendingJoinRequestsCount ?? 0} requests`} tone="warn" />
          </div>
        </div>
      </section>
    </div>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string
  icon: ComponentType<{ size?: number }>
  label: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/60 dark:hover:bg-violet-900/10 transition"
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{label}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
    </Link>
  )
}

function SnapshotRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn'
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className={tone === 'warn' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-slate-900 dark:text-white'}>{value}</p>
    </div>
  )
}
