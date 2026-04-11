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
  full_name: z.string().min(2, 'Enter your full name'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  email: z.string().email('Enter a valid email'),
  index_number: z.string()
    .regex(/^\d{3}[A-Z]{2}\d{8}$/, 'Format must be e.g. 223CS01000941'),
  level: z.enum(['100', '200', '300', '400', 'postgrad']),
  password: z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          username: data.username,
        },
        emailRedirectTo: `${window.location.origin}/verify`,
      },
    })
    if (error) {
      toast.error(error.message)
      return
    }

    // Update profile with extra data after signup
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        index_number: data.index_number,
        level: data.level,
      }).eq('id', user.id)
    }

    toast.success('Check your email to verify your account!')
    router.push('/verify')
  }

  return (
    <div className="w-full max-w-sm bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
      <h2 className="text-white text-xl font-semibold mb-1">Create account</h2>
      <p className="text-slate-400 text-sm mb-6">Join the COSSA community</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Full Name */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Full Name</label>
          <input
            {...register('full_name')}
            placeholder="Kwame Mensah"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Username</label>
          <input
            {...register('username')}
            placeholder="kwame_dev"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@vvu.edu.gh"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Index Number + Level */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Index No.</label>
            <input
              {...register('index_number')}
              placeholder="223CS01000941"
              maxLength={13}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
            {errors.index_number && <p className="text-red-400 text-xs mt-1">{errors.index_number.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Level</label>
            <select
              {...register('level')}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            >
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="postgrad">PG</option>
            </select>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Password</label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm pr-10"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm text-slate-300 mb-1">Confirm Password</label>
          <input
            {...register('confirm_password')}
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          />
          {errors.confirm_password && <p className="text-red-400 text-xs mt-1">{errors.confirm_password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Create Account
        </button>
      </form>

      <p className="text-center text-slate-400 text-sm mt-5">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
