'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Badge } from '@/components/shared/Badge'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { formatEventDate } from '@/lib/utils/formatDate'
import type { Election } from '@/types/app'

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  starts_at: z.string().min(1, 'Required'),
  ends_at: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

export default function AdminElectionsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)

  const { data: elections } = useQuery({
    queryKey: ['admin-elections'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('elections').select('*').order('created_at', { ascending: false })
      return (data ?? []) as Election[]
    },
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate: createElection } = useMutation({
    mutationFn: async (data: FormData) => {
      const supabase = createClient()
      const { error } = await supabase.from('elections').insert({
        ...data,
        created_by: user!.id,
        status: 'draft',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Election created!')
      qc.invalidateQueries({ queryKey: ['admin-elections'] })
      reset()
      setCreating(false)
    },
    onError: () => toast.error('Failed to create election'),
  })

  const { mutate: changeStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'draft' | 'active' | 'closed' }) => {
      const supabase = createClient()
      await supabase.from('elections').update({ status }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-elections'] }),
  })

  const { mutate: deleteElection } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('elections').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-elections'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 dark:text-white text-lg">Elections</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition"
        >
          <Plus size={16} />
          New Election
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form
          onSubmit={handleSubmit((d) => createElection(d))}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white">Create Election</h3>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Title</label>
            <input
              {...register('title')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
              <input
                {...register('starts_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">End Date</label>
              <input
                {...register('ends_at')}
                type="datetime-local"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {elections?.map((e) => (
          <div key={e.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={e.status === 'active' ? 'success' : e.status === 'closed' ? 'default' : 'warning'}>
                  {e.status}
                </Badge>
              </div>
              <p className="font-medium text-slate-900 dark:text-white">{e.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatEventDate(e.starts_at)} → {formatEventDate(e.ends_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {e.status === 'draft' && (
                <button
                  onClick={() => changeStatus({ id: e.id, status: 'active' })}
                  className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium"
                >
                  Activate
                </button>
              )}
              {e.status === 'active' && (
                <button
                  onClick={() => changeStatus({ id: e.id, status: 'closed' })}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Close
                </button>
              )}
              <button
                onClick={() => deleteElection(e.id)}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
