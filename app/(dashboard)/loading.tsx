import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4" style={{ animationDelay: `${i * 75}ms` }}>
          <div className="flex gap-3 mb-3">
            <ShimmerBlock className="w-10 h-10 rounded-full shrink-0" delay={i * 75} />
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-3.5 rounded w-1/3" delay={i * 75 + 40} />
              <ShimmerBlock className="h-3 rounded w-1/4" delay={i * 75 + 90} />
            </div>
          </div>
          <div className="space-y-2">
            <ShimmerBlock className="h-3 rounded w-full" delay={i * 75 + 60} />
            <ShimmerBlock className="h-3 rounded w-5/6" delay={i * 75 + 110} />
            <ShimmerBlock className="h-3 rounded w-2/3" delay={i * 75 + 160} />
          </div>
        </div>
      ))}
    </div>
  )
}
