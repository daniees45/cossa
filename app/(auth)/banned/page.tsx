import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function BannedPage() {
  return (
    <div className="w-full max-w-md bg-slate-800/70 backdrop-blur border border-red-900/40 rounded-2xl p-8 shadow-2xl text-center">
      <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={26} />
      </div>
      <h2 className="text-white text-xl font-semibold mb-2">Account Restricted</h2>
      <p className="text-slate-300 text-sm leading-relaxed">
        Your account has been restricted by COSSA admins. You currently cannot access platform features.
      </p>
      <p className="text-slate-400 text-xs mt-4">
        If you believe this is a mistake, contact an admin for review.
      </p>
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-medium transition"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}
