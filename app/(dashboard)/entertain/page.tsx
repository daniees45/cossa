'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Badge } from '@/components/shared/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Tv2, Calendar, MapPin, Users, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
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

export default function EntertainPage() {
  const [filter, setFilter] = useState<EventType>('all')
  const [tab, setTab] = useState<'events' | 'gallery'>('events')
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
      const { data } = await supabase.storage.from('gallery').list('', { limit: 40 })
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

  const now = new Date()
  const upcoming = (events ?? []).filter((e) => new Date(e.event_date) >= now)
  const past = (events ?? []).filter((e) => new Date(e.event_date) < now)
  const filtered = (upcoming.length ? upcoming : past).filter(
    (e) => filter === 'all' || e.type === filter
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Entertainment</h1>
        <p className="text-slate-500 text-sm mt-1">Events, activities, and media gallery</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
        {(['events', 'gallery'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* EVENTS */}
      {tab === 'events' && (
        <>
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
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
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
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Tv2 size={22} />} title="No events yet" description="Check back soon!" />
          ) : (
            <div className="space-y-4">
              {filtered.map((event) => {
                const joined = rsvpSet?.has(event.id) ?? false
                return (
                  <div key={event.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {event.cover_url && (
                      <img src={event.cover_url} alt="" className="w-full h-44 object-cover" />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <Badge variant={typeVariant[event.type] ?? 'default'} className="mb-1.5">
                            {event.type.replace('_', ' ')}
                          </Badge>
                          <h3 className="font-bold text-slate-900 dark:text-white">{event.title}</h3>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-4">
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
                      {user && (
                        <button
                          onClick={() => toggleRsvp({ eventId: event.id, joined })}
                          className={cn(
                            'w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2',
                            joined
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                              : 'bg-violet-600 hover:bg-violet-500 text-white'
                          )}
                        >
                          {joined && <CheckCircle2 size={16} />}
                          {joined ? "You're attending" : 'RSVP'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* GALLERY */}
      {tab === 'gallery' && (
        <>
          {!galleryUrls || galleryUrls.length === 0 ? (
            <EmptyState icon={<ImageIcon size={22} />} title="Gallery is empty" description="Media will appear here once uploaded by admins." />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {galleryUrls.map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition duration-300 cursor-pointer" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
