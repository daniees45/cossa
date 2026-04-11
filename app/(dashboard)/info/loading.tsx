export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-52 animate-pulse mb-2" />
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
          <div className="flex gap-3 justify-between">
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/5" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-full" />
              <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
