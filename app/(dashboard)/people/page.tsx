'use client'

import { SuggestedUsers } from '@/components/social/SuggestedUsers'
import { TrendingTopics } from '@/components/social/TrendingTopics'
import { UserPlus } from 'lucide-react'

export default function PeoplePage() {
  return (
    <div className="mx-auto max-w-5xl px-3 pt-4 pb-[calc(var(--mobile-nav-height)+1rem)] sm:px-4 sm:pt-6 sm:pb-[calc(var(--mobile-nav-height)+1.5rem)] md:pb-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(241,245,249,0.88))] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700/70 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-cyan-100 p-2 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
            <UserPlus size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600/80 dark:text-cyan-300/80">Discover</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">People to Follow</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Find classmates, teammates, and active COSSA members to connect with.</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <SuggestedUsers />
        </div>
        <aside className="min-w-0">
          <TrendingTopics />
        </aside>
      </div>
    </div>
  )
}
