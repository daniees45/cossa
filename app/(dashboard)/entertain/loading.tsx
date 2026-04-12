import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <ShimmerBlock className="h-8 rounded-xl w-40 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <ShimmerBlock className="h-40" delay={i * 90} />
            <div className="p-4 space-y-2">
              <ShimmerBlock className="h-4 rounded w-3/4" delay={i * 90 + 40} />
              <ShimmerBlock className="h-3 rounded w-1/2" delay={i * 90 + 90} />
              <ShimmerBlock className="h-9 rounded-xl mt-3" delay={i * 90 + 140} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
