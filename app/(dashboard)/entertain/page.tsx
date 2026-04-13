'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Tv2, Calendar, MapPin, Users, Image as ImageIcon, CheckCircle2,
  Search, X, Share2, ChevronLeft, ChevronRight, Clock, Sparkles, BellRing, Film, LayoutGrid, Rows3,
} from 'lucide-react'
import { formatEventDate } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import type { Event } from '@/types/app'

type EventType = 'all' | 'social_event' | 'competition' | 'seminar' | 'fun'
type UpcomingBucket = 'all' | 'today' | 'week' | 'later'
type EventViewMode = 'cards' | 'list'

const typeVariant: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  social_event: 'info',
  competition: 'danger',
  seminar: 'success',
  fun: 'warning',
}

function getCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000)  / 60_000)
  if (days  > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getUpcomingBucket(eventDate: string): Exclude<UpcomingBucket, 'all'> {
  const now = new Date()
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)

  const startTomorrow = new Date(startToday)
  startTomorrow.setDate(startTomorrow.getDate() + 1)

  const dayOfWeek = startToday.getDay() // 0=Sun
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const startNextWeek = new Date(startToday)
  startNextWeek.setDate(startNextWeek.getDate() + daysUntilNextMonday)

  const date = new Date(eventDate)
  if (date < startTomorrow) return 'today'
  if (date < startNextWeek) return 'week'
  return 'later'
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ urls, index, onClose, onPrev, onNext }: {
  urls: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowLeft')   onPrev()
      if (e.key === 'ArrowRight')  onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Counter */}
      <p className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm select-none">
        {index + 1} / {urls.length}
      </p>
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {/* Image */}
      <img
        src={urls[index]}
        alt=""
        className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {/* Next */}
      {index < urls.length - 1 && (
        <button
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
          onClick={(e) => { e.stopPropagation(); onNext() }}
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, joined, past, showRsvp, onToggleRsvp, onShare }: {
  event: Event
  joined: boolean
  past?: boolean
  showRsvp: boolean
  onToggleRsvp: (joined: boolean) => void
  onShare: (event: Event) => Promise<void>
}) {
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition dark:border-slate-700/80 dark:bg-[linear-gradient(145deg,rgba(30,41,59,0.95),rgba(15,23,42,0.93))]',
      !past && 'hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)]',
      past && 'opacity-70 saturate-50',
    )}>
      {event.cover_url && (
        <img src={event.cover_url} alt="" className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge variant={typeVariant[event.type] ?? 'default'}>
                {event.type.replace('_', ' ')}
              </Badge>
              {past && (
                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                  Past
                </span>
              )}
              {!past && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <Clock size={9} />
                  {getCountdown(event.event_date)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{event.title}</h3>
          </div>
          <button
            onClick={() => onShare(event)}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            title="Share event"
          >
            <Share2 size={14} />
          </button>
        </div>

        {event.description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatEventDate(event.event_date)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {event.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {event.rsvp_count} attending
          </span>
        </div>

        {showRsvp && (
          <button
            onClick={() => onToggleRsvp(joined)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
              joined
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-cyan-600 text-white hover:bg-cyan-500',
            )}
          >
            {joined && <CheckCircle2 size={16} />}
            {joined ? "You're attending" : 'RSVP'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EntertainPage() {
  const [filter, setFilter]       = useState<EventType>('all')
  const [tab, setTab]             = useState<'events' | 'gallery'>('events')
  const [search, setSearch]       = useState('')
  const [showPast, setShowPast]   = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [upcomingBucket, setUpcomingBucket] = useState<UpcomingBucket>('all')
  const [eventViewMode, setEventViewMode] = useState<EventViewMode>('cards')
  const [loadedGallery, setLoadedGallery] = useState<Record<string, boolean>>({})
  const { user } = useUser()
  const qc = useQueryClient()

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('entertain:event-view')
      if (saved === 'cards' || saved === 'list') {
        setEventViewMode(saved)
      }
    } catch {
      // ignore storage unavailability
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('entertain:event-view', eventViewMode)
    } catch {
      // ignore storage unavailability
    }
  }, [eventViewMode])

  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
      return (data ?? []) as Event[]
    },
  })

  const { data: rsvpSet } = useQuery({
    queryKey: ['my-rsvps', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('event_rsvps')
        .select('event_id')
        .eq('user_id', user!.id)
      return new Set((data ?? []).map((r) => r.event_id))
    },
  })

  const { data: galleryUrls } = useQuery({
    queryKey: ['gallery'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.storage.from('gallery').list('', { limit: 60 })
      return (data ?? []).map(
        (f) => supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl
      )
    },
  })

  const { mutate: toggleRsvp } = useMutation({
    mutationFn: async ({ eventId, joined }: { eventId: string; joined: boolean }) => {
      const supabase = createClient()
      if (joined) {
        await supabase.from('event_rsvps').delete().match({ event_id: eventId, user_id: user!.id })
      } else {
        await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user!.id })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-rsvps'] })
      qc.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => toast.error('Action failed'),
  })

  async function handleShare(event: Event) {
    const url = `${window.location.origin}/entertain`
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text: event.description ?? undefined, url }) }
      catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    }
  }

  const now = new Date()
  const upcoming = (events ?? []).filter((e) => new Date(e.event_date) >= now)
  const past     = [...(events ?? []).filter((e) => new Date(e.event_date) < now)].reverse()

  function applyFilter(list: Event[]) {
    return list.filter(
      (e) =>
        (filter === 'all' || e.type === filter) &&
        (!search ||
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          (e.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
          (e.location?.toLowerCase().includes(search.toLowerCase()) ?? false))
    )
  }

  const filteredUpcoming = applyFilter(upcoming)
  const filteredPast     = applyFilter(past)
  const groupedUpcoming = {
    today: filteredUpcoming.filter((e) => getUpcomingBucket(e.event_date) === 'today'),
    week: filteredUpcoming.filter((e) => getUpcomingBucket(e.event_date) === 'week'),
    later: filteredUpcoming.filter((e) => getUpcomingBucket(e.event_date) === 'later'),
  }
  const bucketCounts: Record<UpcomingBucket, number> = {
    all: filteredUpcoming.length,
    today: groupedUpcoming.today.length,
    week: groupedUpcoming.week.length,
    later: groupedUpcoming.later.length,
  }
  const visibleUpcoming = upcomingBucket === 'all'
    ? filteredUpcoming
    : groupedUpcoming[upcomingBucket]
  const featuredEvent = upcoming[0] ?? null
  const activeTabIndex = tab === 'events' ? 0 : 1

  function renderUpcomingEvent(event: Event, idx: number) {
    if (eventViewMode === 'list') {
      return (
        <motion.article
          key={event.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.015 * idx, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-slate-200/80 bg-white/92 p-3.5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80"
        >
          <div className="flex items-start gap-3">
            {event.cover_url ? (
              <img src={event.cover_url} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Tv2 size={18} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Badge variant={typeVariant[event.type] ?? 'default'}>{event.type.replace('_', ' ')}</Badge>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700/80 dark:text-cyan-300/80">
                  {getUpcomingBucket(event.event_date) === 'today' ? 'Today' : getUpcomingBucket(event.event_date) === 'week' ? 'This Week' : 'Later'}
                </span>
              </div>
              <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{event.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{event.description || 'No description provided.'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><Calendar size={11} />{formatEventDate(event.event_date)}</span>
                {event.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{event.location}</span>}
                <span className="inline-flex items-center gap-1"><Users size={11} />{event.rsvp_count}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button
                onClick={() => void handleShare(event)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Share event"
              >
                <Share2 size={14} />
              </button>
              {user && (
                <button
                  onClick={() => toggleRsvp({ eventId: event.id, joined: rsvpSet?.has(event.id) ?? false })}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    rsvpSet?.has(event.id)
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'bg-cyan-600 text-white hover:bg-cyan-500'
                  )}
                >
                  {rsvpSet?.has(event.id) ? 'Attending' : 'RSVP'}
                </button>
              )}
            </div>
          </div>
        </motion.article>
      )
    }

    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, delay: 0.02 * idx, ease: [0.22, 1, 0.36, 1] }}
      >
        <EventCard
          event={event}
          joined={rsvpSet?.has(event.id) ?? false}
          showRsvp={!!user}
          onToggleRsvp={(joined) => toggleRsvp({ eventId: event.id, joined })}
          onShare={handleShare}
        />
      </motion.div>
    )
  }

  function jumpToBucketSection(bucket: Exclude<UpcomingBucket, 'all'>) {
    setUpcomingBucket('all')
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`upcoming-${bucket}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-4 sm:px-4 sm:py-6" style={{ fontFamily: '"Space Grotesk", "Manrope", "Avenir Next", sans-serif' }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-[1] h-[28rem] bg-[radial-gradient(circle_at_14%_24%,rgba(45,212,191,0.2),transparent_42%),radial-gradient(circle_at_84%_10%,rgba(251,191,36,0.14),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.86),rgba(248,250,252,0))] dark:bg-[radial-gradient(circle_at_14%_24%,rgba(20,184,166,0.2),transparent_42%),radial-gradient(circle_at_84%_10%,rgba(234,179,8,0.14),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0))]" />
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(240,249,255,0.88),rgba(254,252,232,0.8))] px-4 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(17,24,39,0.94),rgba(12,74,110,0.34))] sm:px-5 sm:py-6">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/20" />
          <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/85 dark:text-cyan-300/85">Culture Deck</p>
              <h1 className="mt-1 text-[2rem] font-black leading-none tracking-[-0.02em] text-slate-900 dark:text-white sm:text-[2.6rem]">Entertainment</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Live events, social hangouts, competitions, and visual highlights with a magazine-style browsing experience.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/70 bg-white/75 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/65">
              <div className="rounded-xl bg-slate-900/5 px-3 py-2 text-center dark:bg-white/5">
                <p className="text-lg font-black text-slate-900 dark:text-white">{upcoming.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Upcoming</p>
              </div>
              <div className="rounded-xl bg-slate-900/5 px-3 py-2 text-center dark:bg-white/5">
                <p className="text-lg font-black text-slate-900 dark:text-white">{past.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Archive</p>
              </div>
              <div className="rounded-xl bg-slate-900/5 px-3 py-2 text-center dark:bg-white/5">
                <p className="text-lg font-black text-slate-900 dark:text-white">{galleryUrls?.length ?? 0}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Gallery</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(240,249,255,0.9))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[linear-gradient(145deg,rgba(30,41,59,0.9),rgba(15,23,42,0.95))] sm:p-5">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />
          <div className="absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/20" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-cyan-700 shadow-sm dark:bg-slate-800/80 dark:text-cyan-300">
                <Sparkles size={12} /> Featured
              </p>
              {featuredEvent ? (
                <>
                  <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{featuredEvent.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{featuredEvent.description ?? 'Next major campus moment. RSVP and invite your friends.'}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Calendar size={13} /> {formatEventDate(featuredEvent.event_date)}
                    {featuredEvent.location && <><span className="mx-1">•</span><MapPin size={13} /> {featuredEvent.location}</>}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Next Major Event</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Fresh event drops are coming soon. Turn on alerts so you never miss first access.</p>
                </>
              )}
            </div>
            <button
              onClick={() => toast.success('We will notify you when new events drop')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(8,145,178,0.35)] transition hover:bg-cyan-500 active:scale-95"
            >
              <BellRing size={15} /> Notify me
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/90"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="pointer-events-none absolute bottom-1.5 top-1.5 w-[calc(50%-0.5rem)] rounded-xl bg-cyan-600 shadow-[0_10px_22px_rgba(8,145,178,0.3)] transition-transform duration-300"
          style={{ transform: `translateX(${activeTabIndex * 100}%)`, viewTransitionName: 'entertainment-tab-pill' }}
        />
        <div className="relative z-[1] flex gap-1 overflow-x-auto">
        {(['events', 'gallery'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch('') }}
            style={{ viewTransitionName: `entertainment-tab-${t}` }}
            className={cn(
              'flex-1 min-w-[8.5rem] rounded-xl py-2.5 text-sm font-semibold transition whitespace-nowrap active:scale-95',
              tab === t
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        </div>
      </motion.div>

      {/* ── EVENTS ──────────────────────────────────────────────────────── */}
      {tab === 'events' && (
        <>
          <motion.div
            className="sticky top-[calc(var(--topbar-height,3.5rem)+0.5rem)] z-10 space-y-2 rounded-2xl border border-slate-200/70 bg-white/75 p-3 backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/65"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100/90 px-3 py-2.5 dark:bg-slate-800/90">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events, places, or topics"
                className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-slate-700" aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="subtle-scrollbar flex gap-2 overflow-x-auto pb-0.5">
              {(['all', 'social_event', 'competition', 'seminar', 'fun'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition active:scale-95',
                    filter === t
                      ? 'bg-cyan-600 text-white shadow-[0_8px_18px_rgba(8,145,178,0.3)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {t === 'all' ? 'All' : t.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="subtle-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
              {([
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'later', label: 'Later' },
              ] as const).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setUpcomingBucket(chip.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    upcomingBucket === chip.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  )}
                >
                  {chip.label} ({bucketCounts[chip.id]})
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 md:hidden dark:border-slate-700 dark:bg-slate-900">
                <button
                  onClick={() => setEventViewMode('cards')}
                  className={cn(
                    'rounded-full p-1.5 transition',
                    eventViewMode === 'cards'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                  aria-label="Card view"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setEventViewMode('list')}
                  className={cn(
                    'rounded-full p-1.5 transition',
                    eventViewMode === 'list'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                  aria-label="List view"
                >
                  <Rows3 size={14} />
                </button>
              </div>
            </div>

            <div className="subtle-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Jump to</span>
              {([
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'later', label: 'Later' },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  onClick={() => jumpToBucketSection(item.id)}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-3xl border border-slate-200/70 bg-[linear-gradient(110deg,rgba(226,232,240,0.6),rgba(241,245,249,0.9),rgba(226,232,240,0.6))] dark:border-slate-700 dark:bg-[linear-gradient(110deg,rgba(30,41,59,0.75),rgba(51,65,85,0.9),rgba(30,41,59,0.75))]" />
              ))}
            </div>
          ) : (
            <>
              {/* Upcoming events */}
              {upcomingBucket === 'all' ? (
                filteredUpcoming.length > 0 ? (
                  <div className="space-y-6">
                    {([
                      { id: 'today', label: 'Today', list: groupedUpcoming.today },
                      { id: 'week', label: 'This Week', list: groupedUpcoming.week },
                      { id: 'later', label: 'Later', list: groupedUpcoming.later },
                    ] as const).map((group) => {
                      if (group.list.length === 0) return null
                      return (
                        <section key={group.id} id={`upcoming-${group.id}`} className="scroll-mt-40 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {group.label} · {group.list.length}
                          </p>
                          <div className={cn(
                            eventViewMode === 'list'
                              ? 'space-y-2.5'
                              : 'grid gap-3 sm:grid-cols-2'
                          )}>
                            {group.list.map((event, i) => renderUpcomingEvent(event, i))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                ) : null
              ) : visibleUpcoming.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {upcomingBucket === 'today' ? 'Today' : upcomingBucket === 'week' ? 'This Week' : 'Later'} · {visibleUpcoming.length}
                  </p>
                  <div className={cn(
                    eventViewMode === 'list'
                      ? 'space-y-2.5'
                      : 'grid gap-3 sm:grid-cols-2'
                  )}>
                    {visibleUpcoming.map((event, i) => renderUpcomingEvent(event, i))}
                  </div>
                </div>
              ) : null}

              {(upcomingBucket === 'all' ? filteredUpcoming.length === 0 : visibleUpcoming.length === 0) && (
                <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                    <Tv2 size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{search ? 'No events found' : 'No upcoming events yet'}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {search ? `No results for "${search}"` : 'Watch this space. New drops are typically announced weekly.'}
                  </p>
                  <button
                    onClick={() => toast.success('Notification preference saved')}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(8,145,178,0.35)] transition hover:bg-cyan-500 active:scale-95"
                  >
                    <BellRing size={15} /> Notify me
                  </button>
                </div>
              )}

              {/* Past events (collapsible) */}
              {filteredPast.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowPast((v) => !v)}
                    className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <span>Past events &middot; {filteredPast.length}</span>
                    <span className="normal-case font-normal">{showPast ? '▲ Hide' : '▼ Show'}</span>
                  </button>
                  {showPast && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {filteredPast.map((event, i) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, delay: 0.015 * i, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <EventCard
                            event={event}
                            joined={rsvpSet?.has(event.id) ?? false}
                            past
                            showRsvp={false}
                            onToggleRsvp={() => {}}
                            onShare={handleShare}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── GALLERY ─────────────────────────────────────────────────────── */}
      {tab === 'gallery' && (
        <>
          {!galleryUrls || galleryUrls.length === 0 ? (
            <div className="space-y-3">
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                  <ImageIcon size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Gallery is warming up</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload highlights and this section will evolve into a visual discovery wall.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((slot) => (
                  <div key={slot} className="aspect-square rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-white/75 text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">
                      <Film size={16} />
                      <span className="text-[11px] font-medium">Coming soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                {galleryUrls.length} photo{galleryUrls.length !== 1 ? 's' : ''} &middot; tap to view
              </p>
              <div className="columns-2 gap-2 space-y-2 sm:columns-3 lg:columns-4">
                {galleryUrls.map((url, i) => (
                  <motion.button
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.015 * i, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {!loadedGallery[url] && (
                      <div className="absolute inset-0 animate-pulse bg-[linear-gradient(115deg,rgba(226,232,240,0.85),rgba(241,245,249,0.95),rgba(226,232,240,0.85))] dark:bg-[linear-gradient(115deg,rgba(30,41,59,0.8),rgba(51,65,85,0.9),rgba(30,41,59,0.8))]" />
                    )}
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onLoad={() => setLoadedGallery((prev) => (prev[url] ? prev : { ...prev, [url]: true }))}
                      className={cn(
                        'h-auto w-full object-cover transition duration-500 group-hover:scale-[1.03]',
                        loadedGallery[url] ? 'opacity-100 blur-0' : 'opacity-0 blur-md'
                      )}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && galleryUrls && (
        <Lightbox
          urls={galleryUrls}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx((i) => Math.min(galleryUrls.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  )
}
