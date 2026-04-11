'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/authStore'
import type { Profile } from '@/types/app'

export function useUser() {
  const { user, setUser } = useAuthStore()
  const [loading, setLoading] = useState(!user)

  useEffect(() => {
    if (user) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (data?.is_banned) {
        await supabase.auth.signOut()
        setUser(null)
        setLoading(false)
        return
      }
      if (data) setUser(data as Profile)
      setLoading(false)
    })
  }, [user, setUser])

  return { user, loading }
}
