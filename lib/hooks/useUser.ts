'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/authStore'
import type { Profile } from '@/types/app'

// Global promise to prevent concurrent auth fetches
let initPromise: Promise<void> | null = null

export function useUser() {
  const { user, setUser } = useAuthStore()
  const [loading, setLoading] = useState(!user)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // If already have user, skip fetch for this mount.
    if (user) {
      setLoading(false)
      return
    }

    // If initialization is already in progress, wait for it
    if (initPromise) {
      initPromise.then(() => setLoading(false))
      return
    }

    // Create abort controller for this mount
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    // Initialize auth
    initPromise = (async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser }, error } = await supabase.auth.getUser()
        
        // Check if this component was unmounted
        if (signal.aborted) return
        
        if (!authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        if (error) {
          console.error('Auth error:', error)
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (signal.aborted) return

        if (data?.is_banned) {
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          if (typeof window !== 'undefined') window.location.replace('/banned')
          return
        }
        
        if (data) setUser(data as Profile)
        setLoading(false)
      } catch (err) {
        if (!signal.aborted) {
          console.error('Failed to fetch user:', err)
          setLoading(false)
        }
      } finally {
        initPromise = null
      }
    })()

    return () => {
      // Cleanup: abort request if component unmounts
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [user, setUser])

  return { user, loading }
}
