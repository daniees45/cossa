export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-1/4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-full" />
            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-5/6" />
            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
