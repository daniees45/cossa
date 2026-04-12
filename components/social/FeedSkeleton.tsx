import { ShimmerBlock } from '@/components/shared/ShimmerBlock'

export function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex gap-3 items-start mb-3">
        <ShimmerBlock className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBlock className="h-3.5 rounded w-32" />
          <ShimmerBlock className="h-2.5 rounded w-20" delay={70} />
        </div>
      </div>
      <div className="space-y-2">
        <ShimmerBlock className="h-3 rounded w-full" />
        <ShimmerBlock className="h-3 rounded w-4/5" delay={90} />
        <ShimmerBlock className="h-3 rounded w-3/5" delay={140} />
      </div>
      <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <ShimmerBlock className="h-3 rounded w-12" delay={120} />
        <ShimmerBlock className="h-3 rounded w-12" delay={170} />
      </div>
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 70}ms` }}>
          <PostSkeleton />
        </div>
      ))}
    </div>
  )
}
