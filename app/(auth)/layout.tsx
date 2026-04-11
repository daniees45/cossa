export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 mb-4">
          <span className="text-white font-bold text-2xl">C</span>
        </div>
        <h1 className="text-white text-2xl font-bold">COSSA</h1>
        <p className="text-violet-300 text-sm mt-1">VVU Computing Science Students Association</p>
      </div>
      {children}
    </div>
  )
}
