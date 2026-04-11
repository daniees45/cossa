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
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex gap-3">
        <Avatar src={currentUser.avatar_url} name={currentUser.full_name} size="sm" />
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
            }}
            placeholder="What's on your mind?"
            rows={3}
            maxLength={MAX_CHARS + 50}
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none outline-none"
          />

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {previews.map((p, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 gap-2 flex-wrap">
            {/* Left: type pills + photo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPostType(t.value)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition',
                    postType === t.value
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600',
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 transition"
              >
                <Image size={13} /> Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={pickFiles} />
            </div>

            {/* Right: counter + post button */}
            <div className="flex items-center gap-3">
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
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition disabled:opacity-40 flex items-center gap-2"
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
