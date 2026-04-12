import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <ShimmerBlock className="h-8 rounded-xl w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex gap-3 items-center mb-3">
            <ShimmerBlock className="w-14 h-14 rounded-full shrink-0" delay={i * 80} />
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-4 rounded w-1/3" delay={i * 80 + 45} />
              <ShimmerBlock className="h-3 rounded w-1/2" delay={i * 80 + 95} />
            </div>
            <ShimmerBlock className="h-9 w-24 rounded-xl" delay={i * 80 + 140} />
          </div>
        </div>
      ))}
    </div>
  )
}
