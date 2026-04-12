'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MailCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleResend() {
    const email = typeof window !== 'undefined' ? sessionStorage.getItem('cossa_pending_email') : null
    if (!email) {
      toast.error('Could not find your email. Please register again.')
      return
    }
    setResending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })
    setResending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setResent(true)
    toast.success('Verification email resent!')
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800/60 p-5 text-center shadow-2xl backdrop-blur sm:p-8">
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
      <button
        onClick={handleResend}
        disabled={resending || resent}
        className="mt-3 w-full py-3 rounded-xl border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {resending && <Loader2 size={14} className="animate-spin" />}
        {resent ? 'Email resent!' : 'Resend verification email'}
      </button>
    </div>
  )
}

