export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-3 py-6 sm:px-4 sm:py-12">
      <div className="mb-6 text-center sm:mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 mb-4">
          <span className="text-white font-bold text-2xl">C</span>
        </div>
        <h1 className="text-white text-2xl font-bold">COSSA</h1>
        <p className="mx-auto mt-1 max-w-[22rem] text-sm text-violet-300 sm:max-w-md">VVU Computing Science Students Association</p>
      </div>
      <div className="w-full flex justify-center">{children}</div>
    </div>
  )
}
