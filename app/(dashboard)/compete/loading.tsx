export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-48 animate-pulse mb-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
          <div className="flex gap-3 justify-between mb-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-1/3" />
            </div>
            <div className="h-9 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}
