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
  Search, X, Share2, ChevronLeft, ChevronRight, Clock, Sparkles, BellRing, Film,
} from 'lucide-react'
import { formatEventDate } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import type { Event } from '@/types/app'

type EventType = 'all' | 'social_event' | 'competition' | 'seminar' | 'fun'

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
      'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden',
      past && 'opacity-70',
    )}>
      {event.cover_url && (
        <img src={event.cover_url} alt="" className="w-full h-44 object-cover" />
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
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  <Clock size={9} />
                  {getCountdown(event.event_date)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{event.title}</h3>
          </div>
          <button
            onClick={() => onShare(event)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition shrink-0"
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
              'w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2',
              joined
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-violet-600 hover:bg-violet-500 text-white',
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
  const { user } = useUser()
  const qc = useQueryClient()

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
  const featuredEvent = upcoming[0] ?? null
  const activeTabIndex = tab === 'events' ? 0 : 1

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:px-4 sm:py-6">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700/80 dark:text-cyan-300/80">Content Hub</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Entertainment</h1>
          <p className="mt-1 text-sm text-slate-500">Events, activities, and gallery highlights in one place.</p>
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.35)] transition hover:bg-violet-500 active:scale-95"
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
          className="pointer-events-none absolute top-1.5 bottom-1.5 w-[calc(50%-0.5rem)] rounded-xl bg-violet-600 shadow-[0_10px_22px_rgba(124,58,237,0.3)] transition-transform duration-300"
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
                      ? 'bg-violet-600 text-white shadow-[0_8px_18px_rgba(124,58,237,0.3)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {t === 'all' ? 'All' : t.replace('_', ' ')}
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
              {filteredUpcoming.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Upcoming &middot; {filteredUpcoming.length}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredUpcoming.map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 12, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.24, delay: 0.02 * i, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <EventCard
                          event={event}
                          joined={rsvpSet?.has(event.id) ?? false}
                          showRsvp={!!user}
                          onToggleRsvp={(joined) => toggleRsvp({ eventId: event.id, joined })}
                          onShare={handleShare}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {filteredUpcoming.length === 0 && (
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
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.35)] transition hover:bg-violet-500 active:scale-95"
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {galleryUrls.map((url, i) => (
                  <motion.button
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    className="group aspect-square overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-800"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.015 * i, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
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
