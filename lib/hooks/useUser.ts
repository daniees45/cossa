'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/authStore'
import type { Profile } from '@/types/app'

export function useUser() {
  const { user, setUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    let mounted = true

    async function hydrateUserById(userId: string) {
      const currentRequest = ++requestSeqRef.current
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (!mounted || signal.aborted || currentRequest !== requestSeqRef.current) return

        if (error || !data) {
          setUser(null)
          return
        }

        if (data.is_banned) {
          await supabase.auth.signOut()
          if (!mounted || signal.aborted || currentRequest !== requestSeqRef.current) return
          setUser(null)
          if (typeof window !== 'undefined') window.location.replace('/banned')
          return
        }

        setUser(data as Profile)
      } catch (err) {
        if (mounted && !signal.aborted) {
          console.error('Failed to fetch user:', err)
          setUser(null)
        }
      }
    }

    async function initializeSession() {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser()

        if (!mounted || signal.aborted) return

        if (error || !authUser) {
          if (error) console.error('Auth error:', error)
          setUser(null)
          return
        }

        await hydrateUserById(authUser.id)
      } finally {
        if (mounted && !signal.aborted) {
          setLoading(false)
        }
      }
    }

    void initializeSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted || signal.aborted) return

      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      setLoading(true)
      void hydrateUserById(session.user.id).finally(() => {
        if (mounted && !signal.aborted) {
          setLoading(false)
        }
      })
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
      abortRef.current?.abort()
    }
  }, [setUser])

  return { user, loading }
}
