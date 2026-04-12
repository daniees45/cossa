'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hash, TrendingUp } from 'lucide-react'

const HASHTAG_RE = /#([a-zA-Z0-9_]+)/g

type Tag = { tag: string; count: number }

export function TrendingTopics() {
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('posts')
      .select('content')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!data) return
        const counts: Record<string, number> = {}
        data.forEach(({ content }) => {
          const matches = Array.from(content.matchAll(HASHTAG_RE))
          matches.forEach((m) => {
            const t = m[1].toLowerCase()
            counts[t] = (counts[t] ?? 0) + 1
          })
        })
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([tag, count]) => ({ tag, count }))
        setTags(sorted)
      })
  }, [])

  if (tags.length === 0) return null

  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))]">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} className="text-violet-500" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-500/80">Momentum</p>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Trending</h3>
        </div>
      </div>
      <ul className="space-y-1.5">
        {tags.map(({ tag, count }, i) => (
          <li key={tag} className="group flex items-center justify-between rounded-2xl border border-slate-100/80 bg-white/75 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/45">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-slate-400 w-4 tabular-nums shrink-0">{i + 1}</span>
              <span className="flex items-center gap-0.5 text-sm font-medium text-violet-600 dark:text-violet-400 truncate">
                <Hash size={12} />
                {tag}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 shrink-0 ml-2">{count} post{count !== 1 ? 's' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
