import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <ShimmerBlock className="h-8 rounded-xl w-52 mb-2" />
      <ShimmerBlock className="h-10 rounded-xl" delay={60} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex gap-3 justify-between">
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-3 rounded w-1/5" delay={i * 70} />
              <ShimmerBlock className="h-4 rounded w-2/3" delay={i * 70 + 45} />
              <ShimmerBlock className="h-3 rounded w-full" delay={i * 70 + 90} />
              <ShimmerBlock className="h-3 rounded w-5/6" delay={i * 70 + 135} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
