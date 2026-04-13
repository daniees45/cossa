'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

const schema = z.object({
  identifier: z.string().min(3, 'Enter your email or username'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const identifier = data.identifier.trim()

    // Resolve username → email if the user didn't enter an email address
    let email = identifier
    if (!identifier.includes('@')) {
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
        'get_login_email',
        { p_identifier: identifier.toLowerCase() },
      )
      if (rpcError || !resolvedEmail) {
        toast.error('Invalid username or password')
        return
      }
      email = resolvedEmail as string
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: data.password })
    if (error) {
      toast.error('Invalid username or password')
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_banned')
        .eq('id', authData.user.id)
        .single()

      if (profile?.is_banned) {
        await supabase.auth.signOut()
        toast.error('Your account is restricted. Contact admin support.')
        return
      }
    }

    const nextParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next')
      : null
    const nextPath = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/'

    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800/60 p-5 shadow-2xl backdrop-blur sm:p-8">
      <h2 className="text-white text-xl font-semibold mb-1">Welcome back</h2>
      <p className="text-slate-400 text-sm mb-6">Sign in to your COSSA account</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Email or Username</label>
          <input
            {...register('identifier')}
            type="text"
            placeholder="you@vvu.edu.gh or kwame_dev"
            autoComplete="username"
            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition text-sm"
          />
          {errors.identifier && (
            <p className="text-red-400 text-xs mt-1">{errors.identifier.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Sign In
        </button>
      </form>

      <p className="text-center text-slate-400 text-sm mt-6">
        No account yet?{' '}
        <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium">
          Register
        </Link>
      </p>
    </div>
  )
}
