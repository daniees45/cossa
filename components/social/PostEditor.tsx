'use client'
import { useState, useRef } from 'react'
import { Image, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/utils/uploadFile'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { useUser } from '@/lib/hooks/useUser'
import type { PostWithAuthor } from '@/types/app'

interface PostEditorProps {
  onPosted?: (post: PostWithAuthor) => void
}

export function PostEditor({ onPosted }: PostEditorProps) {
  const { user } = useUser()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!user) return null
  const currentUser = user

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
    setSubmitting(true)
    try {
      const supabase = createClient()

      // Upload media
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
          media_urls: mediaUrls.length ? mediaUrls : null,
        })
        .select('*, author:profiles!author_id(*)')
        .single()

      if (error) throw error

      onPosted?.({ ...(data as Record<string, unknown>), liked_by_me: false } as import('@/types/app').PostWithAuthor)
      setContent('')
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
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition"
            >
              <Image size={16} />
              Photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={pickFiles}
            />
            <button
              onClick={submit}
              disabled={submitting || (!content.trim() && files.length === 0)}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition disabled:opacity-40 flex items-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
