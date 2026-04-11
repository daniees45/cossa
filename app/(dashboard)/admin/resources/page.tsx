'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/utils/uploadFile'
import { useUser } from '@/lib/hooks/useUser'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, FileText, Download, Pencil } from 'lucide-react'
import { timeAgo } from '@/lib/utils/formatDate'
import type { Resource } from '@/types/app'

const LEVELS = ['100', '200', '300', '400', 'postgrad']

const blankForm = {
  title: '',
  description: '',
  course_code: '',
  level: '',
}

const FILE_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-powerpoint': '📊',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📊',
  'application/zip': '🗜️',
  'text/plain': '📃',
}

export default function AdminResourcesPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
      return (data ?? []) as Resource[]
    },
  })

  const resourceLevels = new Set(resources.map((r) => r.level).filter(Boolean)).size

  const { mutate: deleteResource } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] })
      toast.success('Resource deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  function startEdit(r: Resource) {
    setEditingId(r.id)
    setForm({
      title: r.title,
      description: r.description ?? '',
      course_code: r.course_code ?? '',
      level: r.level ?? '',
    })
    setFile(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(blankForm)
    setFile(null)
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) setFile(picked)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!editingId && (!file || !user)) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      if (editingId) {
        const { error } = await supabase
          .from('resources')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            course_code: form.course_code.trim().toUpperCase() || null,
            level: form.level || null,
          })
          .eq('id', editingId)
        if (error) throw error
        toast.success('Resource updated!')
      } else {
        const path = `${user!.id}/${Date.now()}-${file!.name.replace(/\s+/g, '_')}`
        const fileUrl = await uploadFile(file!, 'resources', path)
        const { error } = await supabase.from('resources').insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          course_code: form.course_code.trim().toUpperCase() || null,
          level: form.level || null,
          file_url: fileUrl,
          uploaded_by: user!.id,
        })
        if (error) throw error
        toast.success('Resource uploaded!')
      }
      qc.invalidateQueries({ queryKey: ['admin-resources'] })
      cancelForm()
    } catch {
      toast.error(editingId ? 'Update failed' : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 via-slate-900/20 to-emerald-500/10 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-white">Resource Vault</h1>
            <p className="mt-1 text-sm text-slate-300">Upload, organize, and maintain learning materials for all students.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200">Files: {resources.length}</span>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-200">Levels covered: {resourceLevels}</span>
            <button
              onClick={() => { cancelForm(); setShowForm(!showForm) }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
            >
              <Plus size={15} />
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Upload form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Resource' : 'New Resource'}</h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Data Structures Lecture Notes Week 4"
              required
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description (optional)"
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Course Code</label>
              <input
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                placeholder="e.g. CSC301"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All levels</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l === 'postgrad' ? 'Postgraduate' : `${l} Level`}</option>
                ))}
              </select>
            </div>
          </div>

          {/* File picker — only for new uploads */}
          {!editingId && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">File *</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 cursor-pointer hover:border-violet-400 transition"
            >
              <FileText size={20} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                {file ? (
                  <>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Click to select — PDF, DOCX, PPTX, ZIP, TXT (max 50 MB)</p>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt"
              onChange={onFilePick}
            />
          </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || (!editingId && !file)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Upload Resource'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Resources list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No resources uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3"
            >
              <span className="text-xl shrink-0">{FILE_ICON[r.file_url?.split('.').pop() ?? ''] ?? '📁'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{r.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[r.course_code, r.level ? `Level ${r.level}` : null].filter(Boolean).join(' · ')}
                  {' · '}
                  <span className="inline-flex items-center gap-0.5"><Download size={10} /> {r.downloads}</span>
                  {' · '}
                  {timeAgo(r.created_at)}
                </p>
              </div>
              <a
                href={r.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-600 hover:underline shrink-0"
              >
                View
              </a>
              <button
                onClick={() => startEdit(r)}
                title="Edit"
                className="text-slate-400 hover:text-violet-600 transition shrink-0"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => deleteResource(r.id)}
                className="text-slate-400 hover:text-red-500 transition shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
