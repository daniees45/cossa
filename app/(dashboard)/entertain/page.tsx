'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  Tv2, Calendar, MapPin, Users, Image as ImageIcon, CheckCircle2,
  Search, X, Share2, ChevronLeft, ChevronRight, Clock,
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

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Entertainment</h1>
        <p className="text-slate-500 text-sm mt-1">Events, activities, and media gallery</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 overflow-x-auto">
        {(['events', 'gallery'] as const).map((t) => (
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

      {/* ── EVENTS ──────────────────────────────────────────────────────── */}
      {tab === 'events' && (
        <>
          {/* Search */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'social_event', 'competition', 'seminar', 'fun'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition',
                  filter === t
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                )}
              >
                {t === 'all' ? 'All' : t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
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
                  {filteredUpcoming.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      joined={rsvpSet?.has(event.id) ?? false}
                      showRsvp={!!user}
                      onToggleRsvp={(joined) => toggleRsvp({ eventId: event.id, joined })}
                      onShare={handleShare}
                    />
                  ))}
                </div>
              )}

              {filteredUpcoming.length === 0 && (
                <EmptyState
                  icon={<Tv2 size={22} />}
                  title={search ? 'No events found' : 'No upcoming events'}
                  description={search ? `No results for "${search}"` : 'Check back soon for new events!'}
                />
              )}

              {/* Past events (collapsible) */}
              {filteredPast.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowPast((v) => !v)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    <span>Past events &middot; {filteredPast.length}</span>
                    <span className="normal-case font-normal">{showPast ? '▲ Hide' : '▼ Show'}</span>
                  </button>
                  {showPast && filteredPast.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      joined={rsvpSet?.has(event.id) ?? false}
                      past
                      showRsvp={false}
                      onToggleRsvp={() => {}}
                      onShare={handleShare}
                    />
                  ))}
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
            <EmptyState
              icon={<ImageIcon size={22} />}
              title="Gallery is empty"
              description="Media will appear here once uploaded by admins."
            />
          ) : (
            <>
              <p className="text-xs text-slate-400">
                {galleryUrls.length} photo{galleryUrls.length !== 1 ? 's' : ''} &middot; tap to view
              </p>
              <div className="grid grid-cols-3 gap-2">
                {galleryUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    className="aspect-square rounded-xl overflow-hidden focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  </button>
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
