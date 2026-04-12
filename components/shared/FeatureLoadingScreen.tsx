import { ShimmerBlock } from '@/components/shared/ShimmerBlock'
import { cn } from '@/lib/utils/cn'

interface FeatureLoadingScreenProps {
  title: string
  subtitle?: string
  accentClassName?: string
  rows?: number
}

export function FeatureLoadingScreen({
  title,
  subtitle,
  accentClassName = 'from-cyan-500 to-emerald-500',
  rows = 3,
}: FeatureLoadingScreenProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-3 py-4 sm:px-4 sm:py-6">
      <section className="relative overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-slate-700/70 dark:bg-slate-900/92 sm:p-6">
        <div className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl', accentClassName)} />
        <div className={cn('pointer-events-none absolute -bottom-14 -left-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-2xl', accentClassName)} />

        <div className="relative flex items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Loading</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>}
          </div>
          <div className="relative h-9 w-9 shrink-0 rounded-full border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-800/80">
            <div className={cn('absolute inset-0 animate-[spin_1.4s_linear_infinite] rounded-full border-2 border-transparent border-t-current', subtitle ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300')} />
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <article
            key={i}
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800/95"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 flex items-center gap-3">
              <ShimmerBlock className="h-10 w-10 shrink-0 rounded-full" delay={i * 60} />
              <div className="min-w-0 flex-1 space-y-2">
                <ShimmerBlock className="h-3.5 w-2/5 rounded" delay={i * 60 + 45} />
                <ShimmerBlock className="h-3 w-1/4 rounded" delay={i * 60 + 95} />
              </div>
              <ShimmerBlock className="h-7 w-16 rounded-full" delay={i * 60 + 135} />
            </div>
            <div className="space-y-2">
              <ShimmerBlock className="h-3 w-full rounded" delay={i * 60 + 60} />
              <ShimmerBlock className="h-3 w-5/6 rounded" delay={i * 60 + 110} />
              <ShimmerBlock className="h-3 w-2/3 rounded" delay={i * 60 + 160} />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
