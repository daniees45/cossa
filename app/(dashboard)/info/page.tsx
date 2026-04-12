'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/shared/Badge'
import { Avatar } from '@/components/shared/Avatar'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Megaphone, BookOpen, Download, Search, Copy, Check,
  ArrowUpDown, FileText, FileSpreadsheet, FileImage, File, X,
} from 'lucide-react'
import { timeAgo, formatDate } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import type { Announcement, Resource } from '@/types/app'

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'announcements' | 'resources'
type Category = 'all' | 'news' | 'academic' | 'urgent'
type SortBy = 'newest' | 'downloads'
type FileType = 'all' | 'pdf' | 'document' | 'spreadsheet' | 'image' | 'other'
type AnnWithAuthor = Announcement & { author: { full_name: string; avatar_url: string | null } }

// ── Helpers ──────────────────────────────────────────────────────────────────
const categoryVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  news: 'info',
  academic: 'success',
  urgent: 'danger',
}

function isNew(iso: string, days = 3) {
  return Date.now() - new Date(iso).getTime() < days * 86_400_000
}

function detectFileType(url: string): FileType {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'txt', 'md', 'ppt', 'pptx'].includes(ext)) return 'document'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  return 'other'
}

const FILE_ICON_COLORS: Record<FileType, string> = {
  pdf:         'bg-red-100   dark:bg-red-900/30   text-red-600   dark:text-red-400',
  document:    'bg-blue-100  dark:bg-blue-900/30  text-blue-600  dark:text-blue-400',
  spreadsheet: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  image:       'bg-pink-100  dark:bg-pink-900/30  text-pink-600  dark:text-pink-400',
  other:       'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  all:         '',
}

const FILE_LABELS: Record<FileType, string> = {
  pdf: 'PDF', document: 'Document', spreadsheet: 'Spreadsheet',
  image: 'Image', other: 'Other', all: 'All',
}

function FileIcon({ type, size = 18 }: { type: FileType; size?: number }) {
  if (type === 'spreadsheet') return <FileSpreadsheet size={size} />
  if (type === 'image') return <FileImage size={size} />
  if (type === 'pdf' || type === 'document') return <FileText size={size} />
  return <File size={size} />
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap',
        active
          ? 'bg-violet-600 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
      )}
    >
      {children}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function InfoPage() {
  const [tab, setTab] = useState<Tab>('announcements')
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')

  const { data: announcements, isLoading: aLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('announcements')
        .select('*, author:profiles!author_id(full_name, avatar_url)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as AnnWithAuthor[]
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

  // ── Category counts ─────────────────────────────────────────────────────
  const catCounts = useMemo(() => {
    const m: Record<string, number> = { all: 0, news: 0, academic: 0, urgent: 0 }
    for (const a of announcements ?? []) {
      m.all++
      m[a.category] = (m[a.category] ?? 0) + 1
    }
    return m
  }, [announcements])

  // ── Filtered announcements ──────────────────────────────────────────────
  const filteredAnnouncements = useMemo(() => (announcements ?? []).filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.body.toLowerCase().includes(search.toLowerCase()))
  ), [announcements, category, search])

  // ── Filtered + sorted resources ─────────────────────────────────────────
  const filteredResources = useMemo(() => {
    const base = (resources ?? []).filter((r) => {
      const ft = detectFileType(r.file_url)
      return (
        (levelFilter === 'all' || r.level === levelFilter) &&
        (fileTypeFilter === 'all' || ft === fileTypeFilter) &&
        (r.title.toLowerCase().includes(search.toLowerCase()) ||
          (r.course_code?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false))
      )
    })
    return sortBy === 'downloads'
      ? [...base].sort((a, b) => b.downloads - a.downloads)
      : base
  }, [resources, levelFilter, fileTypeFilter, sortBy, search])

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Information</h1>
        <p className="text-slate-500 text-sm mt-1">Announcements, news, and academic resources</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 overflow-x-auto">
        {(['announcements', 'resources'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch('') }}
            className={cn(
              'flex-1 min-w-[8.5rem] py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
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
          placeholder={tab === 'announcements' ? 'Search announcements…' : 'Search by title, course or description…'}
          className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none flex-1"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── ANNOUNCEMENTS ─────────────────────────────────────────────────── */}
      {tab === 'announcements' && (
        <>
          {/* Category filter with counts */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'news', 'academic', 'urgent'] as const).map((c) => {
              const count = catCounts[c] ?? 0
              return (
                <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                  {!aLoading && <span className="ml-1 opacity-70">({count})</span>}
                </FilterPill>
              )
            })}
          </div>

          {/* Result count */}
          {!aLoading && search && (
            <p className="text-xs text-slate-400">
              {filteredAnnouncements.length} result{filteredAnnouncements.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
            </p>
          )}

          {aLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={22} />}
              title="No announcements"
              description={search ? 'Try a different search term.' : 'Nothing to show in this category yet.'}
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

      {/* ── RESOURCES ────────────────────────────────────────────────────── */}
      {tab === 'resources' && (
        <>
          {/* Level filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', '100', '200', '300', '400'] as const).map((l) => (
              <FilterPill key={l} active={levelFilter === l} onClick={() => setLevelFilter(l)}>
                {l === 'all' ? 'All Levels' : `Level ${l}`}
              </FilterPill>
            ))}
          </div>

          {/* File type filter + sort */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pdf', 'document', 'spreadsheet', 'image', 'other'] as const).map((ft) => (
                <FilterPill key={ft} active={fileTypeFilter === ft} onClick={() => setFileTypeFilter(ft)}>
                  {FILE_LABELS[ft]}
                </FilterPill>
              ))}
            </div>
            <button
              onClick={() => setSortBy((s) => s === 'newest' ? 'downloads' : 'newest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0"
            >
              <ArrowUpDown size={11} />
              {sortBy === 'newest' ? 'Newest first' : 'Most downloaded'}
            </button>
          </div>

          {/* Result count */}
          {!rLoading && search && (
            <p className="text-xs text-slate-400">
              {filteredResources.length} result{filteredResources.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
            </p>
          )}

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
              description="Try adjusting your filters or search term."
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

// ── Announcement card ─────────────────────────────────────────────────────────
function AnnouncementCard({ announcement }: { announcement: AnnWithAuthor }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const long = announcement.body.length > 200

  async function copyText() {
    await navigator.clipboard.writeText(`${announcement.title}\n\n${announcement.body}`)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden transition',
      announcement.category === 'urgent'
        ? 'border-red-200 dark:border-red-800'
        : 'border-slate-200 dark:border-slate-700',
    )}>
      {announcement.pinned && (
        <div className="px-4 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-medium flex items-center gap-1.5">
          📌 Pinned announcement
        </div>
      )}
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={categoryVariant[announcement.category] ?? 'default'}>
              {announcement.category}
            </Badge>
            {isNew(announcement.created_at, 3) && (
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wide">
                New
              </span>
            )}
          </div>
          {/* Copy button */}
          <button
            onClick={copyText}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition shrink-0"
            title="Copy announcement text"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
        </div>

        <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5">{announcement.title}</h3>

        <p className={cn('text-sm text-slate-600 dark:text-slate-300 leading-relaxed', !expanded && 'line-clamp-3')}>
          {announcement.body}
        </p>
        {long && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-violet-600 mt-1 hover:underline">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Footer: avatar + author + date */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <Avatar src={announcement.author.avatar_url} name={announcement.author.full_name} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
              {announcement.author.full_name}
            </p>
            <p className="text-[11px] text-slate-400" title={formatDate(announcement.created_at)}>
              {timeAgo(announcement.created_at)} · {formatDate(announcement.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Resource card ─────────────────────────────────────────────────────────────
function ResourceCard({ resource }: { resource: Resource }) {
  const qc = useQueryClient()
  const fileType = detectFileType(resource.file_url)
  const [descExpanded, setDescExpanded] = useState(false)
  const hasLongDesc = (resource.description?.length ?? 0) > 100

  async function handleDownload() {
    const supabase = createClient()
    await supabase
      .from('resources')
      .update({ downloads: resource.downloads + 1 })
      .eq('id', resource.id)
    qc.setQueryData(['resources'], (old: Resource[] | undefined) =>
      (old ?? []).map((r) => r.id === resource.id ? { ...r, downloads: r.downloads + 1 } : r)
    )
    window.open(resource.file_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-start gap-3">
        {/* File type icon */}
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', FILE_ICON_COLORS[fileType])}>
          <FileIcon type={fileType} size={20} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <p className="font-medium text-slate-900 dark:text-white text-sm">{resource.title}</p>
                {isNew(resource.created_at, 7) && (
                  <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                    New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-400">
                <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium', FILE_ICON_COLORS[fileType])}>
                  {FILE_LABELS[fileType]}
                </span>
                {resource.course_code && <span>{resource.course_code}</span>}
                {resource.level && <span>Level {resource.level}</span>}
                <span>{resource.downloads} download{resource.downloads !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {/* Download button */}
            <button
              onClick={handleDownload}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 transition shrink-0 text-slate-600 dark:text-slate-300"
              title="Download"
            >
              <Download size={16} />
            </button>
          </div>

          {/* Description */}
          {resource.description && (
            <div className="mt-1.5">
              <p className={cn('text-xs text-slate-500 dark:text-slate-400 leading-relaxed', !descExpanded && 'line-clamp-2')}>
                {resource.description}
              </p>
              {hasLongDesc && (
                <button onClick={() => setDescExpanded(!descExpanded)} className="text-[11px] text-violet-600 mt-0.5 hover:underline">
                  {descExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
