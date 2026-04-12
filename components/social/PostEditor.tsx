'use client'
import { useState, useRef } from 'react'
import { Image, X, Loader2, FileText, Laugh, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/utils/uploadFile'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { useUser } from '@/lib/hooks/useUser'
import { cn } from '@/lib/utils/cn'
import type { PostWithAuthor } from '@/types/app'

type PostType = 'post' | 'meme' | 'achievement'

const POST_TYPES: { value: PostType; label: string; icon: React.ReactNode }[] = [
  { value: 'post', label: 'Post', icon: <FileText size={13} /> },
  { value: 'meme', label: 'Meme', icon: <Laugh size={13} /> },
  { value: 'achievement', label: 'Achievement', icon: <Trophy size={13} /> },
]

const MAX_CHARS = 500

interface PostEditorProps {
  onPosted?: (post: PostWithAuthor) => void
}

export function PostEditor({ onPosted }: PostEditorProps) {
  const { user } = useUser()
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<PostType>('post')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null
  const currentUser = user

  const remaining = MAX_CHARS - content.length
  const isOverLimit = remaining < 0
  const showCounter = remaining <= 100

  // Circular counter arc
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(content.length / MAX_CHARS, 1)
  const strokeDashoffset = circumference * (1 - progress)

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, 4)
    setFiles(picked)
    setPreviews(picked.map((f) => URL.createObjectURL(f)))
  }

  function removeFile(i: number) {
    setFiles((f) => f.filter((_, idx) => idx !== i))
    setPreviews((p) => p.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!content.trim() && files.length === 0) return
    if (isOverLimit) return
    setSubmitting(true)
    try {
      const supabase = createClient()

      const mediaUrls: string[] = []
      for (const file of files) {
        const path = `${currentUser.id}/${Date.now()}-${file.name}`
        const url = await uploadFile(file, 'posts', path)
        mediaUrls.push(url)
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: currentUser.id,
          content: content.trim(),
          type: postType,
          media_urls: mediaUrls.length ? mediaUrls : null,
        })
        .select('*, author:profiles!author_id(*)')
        .single()

      if (error) throw error

      onPosted?.({ ...(data as Record<string, unknown>), liked_by_me: false, bookmarked_by_me: false } as import('@/types/app').PostWithAuthor)
      setContent('')
      setPostType('post')
      setFiles([])
      setPreviews([])
      toast.success('Posted!')
    } catch {
      toast.error('Failed to post. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-[1.55rem] border border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3 dark:border-slate-700/70 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Avatar src={currentUser.avatar_url} name={currentUser.full_name} size="sm" />
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser.full_name}</p>
              <p className="text-xs text-slate-400">Share an update with the community</p>
            </div>
            <div className="hidden sm:flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 dark:border-slate-700 dark:bg-slate-900/70">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPostType(t.value)}
                  title={t.label}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition',
                    postType === t.value
                      ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                  )}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
            }}
            placeholder="What's on your mind?"
            rows={3}
            maxLength={MAX_CHARS + 50}
            className="min-h-28 w-full resize-none rounded-[1.35rem] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:focus:border-cyan-700 dark:focus:ring-cyan-950/50"
          />

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200/80 sm:h-24 sm:w-24 dark:border-slate-700/70">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: modern tool row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/90 p-1 sm:hidden dark:border-slate-700 dark:bg-slate-900/70">
                {POST_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPostType(t.value)}
                    title={t.label}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition',
                      postType === t.value
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                    )}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>

              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPostType(t.value)}
                  className={cn(
                    'hidden shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:inline-flex sm:items-center sm:gap-1.5',
                    postType === t.value
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700/70 dark:bg-cyan-950/40 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-cyan-300 hover:text-cyan-700 dark:hover:text-cyan-300',
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-cyan-300"
              >
                <Image size={13} /> Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={pickFiles} />
              {files.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {files.length} attachment{files.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Right: counter + post button */}
            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              {showCounter && (
                <div className="flex items-center gap-1.5">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
                    <circle cx="12" cy="12" r={radius} fill="none" stroke="currentColor"
                      className="text-slate-200 dark:text-slate-700" strokeWidth="2.5" />
                    <circle cx="12" cy="12" r={radius} fill="none"
                      stroke={isOverLimit ? '#ef4444' : remaining <= 20 ? '#f59e0b' : '#7c3aed'}
                      strokeWidth="2.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round" />
                  </svg>
                  <span className={cn('text-xs font-medium tabular-nums', isOverLimit ? 'text-red-500' : 'text-slate-400')}>
                    {remaining}
                  </span>
                </div>
              )}
              <button
                onClick={submit}
                disabled={submitting || (!content.trim() && files.length === 0) || isOverLimit}
                className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,#0f172a,#0ea5e9)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(14,165,233,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_16px_34px_rgba(14,165,233,0.3)] disabled:opacity-40 sm:w-auto"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
