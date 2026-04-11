import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function VerifyPage() {
  return (
    <div className="w-full max-w-sm bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-violet-600/20 mb-4">
        <MailCheck className="text-violet-400" size={28} />
      </div>
      <h2 className="text-white text-xl font-semibold mb-2">Check your email</h2>
      <p className="text-slate-400 text-sm mb-6">
        We sent a verification link to your email. Click it to activate your account and join COSSA.
      </p>
      <Link
        href="/login"
        className="inline-block w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition text-sm"
      >
        Back to Login
      </Link>
    </div>
  )
}
