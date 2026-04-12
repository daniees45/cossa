'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import Link from 'next/link'
import { UserPlus, Loader2, Check } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'

type SuggestedUser = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  department: string | null
}

export function SuggestedUsers() {
  const { user } = useUser()
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function load() {
      // Get IDs the user already follows
      const { data: followData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user!.id)

      const alreadyFollowing = new Set((followData ?? []).map((r: { following_id: string }) => r.following_id))
      alreadyFollowing.add(user!.id) // exclude self

      // Fetch users not in that set
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, department')
        .not('id', 'in', `(${[...alreadyFollowing].join(',')})`)
        .limit(5)

      if (data) setSuggestions(data as SuggestedUser[])
      setLoading(false)
    }

    load()
  }, [user])

  async function follow(targetId: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId })
    setFollowing((prev) => new Set([...prev, targetId]))
  }

  if (!user || (!loading && suggestions.length === 0)) return null

  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600/80 dark:text-cyan-300/80">People</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Who to follow</h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-violet-500" />
        </div>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100/80 bg-white/75 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/45">
              <Link href={`/profile/${s.username}`} className="shrink-0">
                <Avatar src={s.avatar_url} name={s.full_name} size="sm" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${s.username}`}>
                  <p className="text-xs font-semibold text-slate-800 dark:text-white truncate leading-tight hover:text-violet-600 transition">
                    {s.full_name}
                  </p>
                </Link>
                <p className="text-[11px] text-slate-400 truncate">@{s.username}</p>
              </div>
              <button
                onClick={() => follow(s.id)}
                disabled={following.has(s.id)}
                className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition
                  disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200
                  enabled:border-violet-600 enabled:text-violet-600 enabled:hover:bg-violet-50 dark:enabled:hover:bg-violet-900/20"
              >
                {following.has(s.id) ? <><Check size={11} /> Following</> : <><UserPlus size={11} /> Follow</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
