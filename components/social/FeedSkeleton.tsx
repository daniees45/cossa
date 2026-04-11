export function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 animate-pulse">
      <div className="flex gap-3 items-start mb-3">
        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-32" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/5" />
      </div>
      <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12" />
      </div>
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)}
    </div>
  )
}
