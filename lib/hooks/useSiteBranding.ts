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

    const channel = supabase
      .channel(`site-branding-${Date.now()}`)
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
    const { error } = await supabase
      .from('site_branding')
      .update({ ...brandingToRow(next), updated_by: updatedBy ?? null })
      .eq('id', 1)

    if (error) throw error
    setBranding(next)
  }

  return { branding, loading, updateBranding }
}
