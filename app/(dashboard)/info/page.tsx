'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Megaphone, BookOpen, Download, Search } from 'lucide-react'
import { timeAgo } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import type { Announcement, Resource } from '@/types/app'

type Tab = 'announcements' | 'resources'
type Category = 'all' | 'news' | 'academic' | 'urgent'

const categoryVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  news: 'info',
  academic: 'success',
  urgent: 'danger',
}

export default function InfoPage() {
  const [tab, setTab] = useState<Tab>('announcements')
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')

  const { data: announcements, isLoading: aLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('announcements')
        .select('*, author:profiles!author_id(full_name, avatar_url)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      return (data ?? []) as (Announcement & { author: { full_name: string; avatar_url: string | null } })[]
    },
  })

  const { data: resources, isLoading: rLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as Resource[]
    },
  })

  const filteredAnnouncements = (announcements ?? []).filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      a.title.toLowerCase().includes(search.toLowerCase())
  )

  const filteredResources = (resources ?? []).filter(
    (r) =>
      (levelFilter === 'all' || r.level === levelFilter) &&
      (r.title.toLowerCase().includes(search.toLowerCase()) ||
        (r.course_code?.toLowerCase().includes(search.toLowerCase()) ?? false))
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Information</h1>
        <p className="text-slate-500 text-sm mt-1">Announcements, news, and academic resources</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
        {(['announcements', 'resources'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
        <Search size={15} className="text-slate-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'announcements' ? 'Search announcements…' : 'Search by title or course code…'}
          className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none flex-1"
        />
      </div>

      {/* ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'news', 'academic', 'urgent'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition',
                  category === c
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                )}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          {aLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={22} />}
              title="No announcements"
              description="Nothing to show in this category yet."
            />
          ) : (
            <div className="space-y-3">
              {filteredAnnouncements.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
              ))}
            </div>
          )}
        </>
      )}

      {/* RESOURCES */}
      {tab === 'resources' && (
        <>
          {/* Level filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', '100', '200', '300', '400'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition',
                  levelFilter === l
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                )}
              >
                {l === 'all' ? 'All Levels' : `Level ${l}`}
              </button>
            ))}
          </div>

          {rLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={22} />}
              title="No resources found"
              description="Try adjusting your filters."
            />
          ) : (
            <div className="space-y-3">
              {filteredResources.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement & { author: { full_name: string; avatar_url: string | null } }
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden transition',
      announcement.category === 'urgent'
        ? 'border-red-200 dark:border-red-800'
        : 'border-slate-200 dark:border-slate-700'
    )}>
      {announcement.pinned && (
        <div className="px-4 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-medium">
          📌 Pinned
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={categoryVariant[announcement.category] ?? 'default'}>
                {announcement.category}
              </Badge>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{announcement.title}</h3>
          </div>
        </div>
        <p className={cn('text-sm text-slate-600 dark:text-slate-300', !expanded && 'line-clamp-3')}>
          {announcement.body}
        </p>
        {announcement.body.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-violet-600 mt-1 hover:underline"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        <p className="text-xs text-slate-400 mt-3">
          {announcement.author.full_name} · {timeAgo(announcement.created_at)}
        </p>
      </div>
    </div>
  )
}

function ResourceCard({ resource }: { resource: Resource }) {
  async function handleDownload() {
    const supabase = createClient()
    await supabase
      .from('resources')
      .update({ downloads: resource.downloads + 1 })
      .eq('id', resource.id)
    window.open(resource.file_url, '_blank')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
        <BookOpen size={18} className="text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{resource.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {resource.course_code && `${resource.course_code} · `}
          Level {resource.level} · {resource.downloads} downloads
        </p>
      </div>
      <button
        onClick={handleDownload}
        className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-violet-100 dark:hover:bg-violet-900/30 transition shrink-0"
      >
        <Download size={16} className="text-slate-600 dark:text-slate-300" />
      </button>
    </div>
  )
}
