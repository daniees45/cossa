export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-40 animate-pulse mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
            <div className="h-40 bg-slate-200 dark:bg-slate-700" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-1/2" />
              <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-xl mt-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
