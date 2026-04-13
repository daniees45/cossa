'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_SITE_BRANDING,
  type SiteBranding,
  brandingFromRow,
  brandingToRow,
} from '@/lib/siteBranding'

export function useSiteBranding() {
  const [branding, setBranding] = useState<SiteBranding>(DEFAULT_SITE_BRANDING)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const channelName = 'site-branding-global'

    const load = async () => {
      try {
        const { data } = await supabase
          .from('site_branding')
          .select('site_title, site_subtitle, logo_url, light_background, dark_background')
          .eq('id', 1)
          .single()
        if (!cancelled) setBranding(brandingFromRow(data))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    // In Strict Mode or fast remounts, a channel with the same topic may still be alive.
    // Remove stale branding channels first so we always attach callbacks before subscribe.
    for (const existing of supabase.getChannels()) {
      if (existing.topic === `realtime:${channelName}`) {
        void supabase.removeChannel(existing)
      }
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_branding', filter: 'id=eq.1' }, (payload) => {
        setBranding(brandingFromRow(payload.new as {
          site_title: string
          site_subtitle: string
          logo_url: string
          light_background: string
          dark_background: string
        }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_branding', filter: 'id=eq.1' }, (payload) => {
        setBranding(brandingFromRow(payload.new as {
          site_title: string
          site_subtitle: string
          logo_url: string
          light_background: string
          dark_background: string
        }))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  async function updateBranding(next: SiteBranding, updatedBy?: string) {
    const supabase = createClient()
    const previous = branding
    const { error } = await supabase
      .from('site_branding')
      .update({ ...brandingToRow(next), updated_by: updatedBy ?? null })
      .eq('id', 1)

    if (error) throw error

    void supabase.rpc('log_admin_action', {
      p_action: 'site_branding_updated',
      p_target_type: 'site_branding',
      p_target_id: null,
      p_details: {
        before: brandingToRow(previous),
        after: brandingToRow(next),
      },
    })

    setBranding(next)
  }

  return { branding, loading, updateBranding }
}
