import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export default function Loading() {
  return (
    <div className="flex h-full">
      <div className="w-full md:w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <ShimmerBlock className="h-4 rounded w-20 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <ShimmerBlock className="w-5 h-5 rounded" delay={i * 60} />
            <ShimmerBlock className="h-3 rounded flex-1" delay={i * 60 + 50} />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}
