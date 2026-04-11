'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, MoreHorizontal, Pin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { timeAgo } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import type { PostWithAuthor } from '@/types/app'
import { useUser } from '@/lib/hooks/useUser'

interface PostCardProps {
  post: PostWithAuthor
  onDeleted?: (id: string) => void
}

export function PostCard({ post, onDeleted }: PostCardProps) {
  const { user } = useUser()
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likes, setLikes] = useState(post.likes_count)
  const [showComments, setShowComments] = useState(false)

  async function toggleLike() {
    if (!user) return
    const supabase = createClient()
    const next = !liked
    setLiked(next)
    setLikes((c) => (next ? c + 1 : c - 1))

    if (next) {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    } else {
      await supabase.from('post_likes').delete().match({ post_id: post.id, user_id: user.id })
    }
  }

  async function deletePost() {
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) toast.error('Failed to delete post')
    else onDeleted?.(post.id)
  }

  function handleShare() {
    navigator.clipboard.writeText(`${window.location.origin}/social/${post.id}`)
    toast.success('Link copied!')
  }

  return (
    <article className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Pinned banner */}
      {post.pinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
          <Pin size={12} className="text-violet-600" />
          <span className="text-violet-700 dark:text-violet-300 text-xs font-medium">Pinned post</span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <Link href={`/profile/${post.author.username}`} className="flex items-center gap-2.5">
            <Avatar src={post.author.avatar_url} name={post.author.full_name} size="sm" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{post.author.full_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">@{post.author.username} · {timeAgo(post.created_at)}</p>
            </div>
          </Link>
          {user?.id === post.author_id && (
            <div className="relative group">
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition">
                <MoreHorizontal size={16} />
              </button>
              <div className="absolute right-0 top-8 hidden group-focus-within:block bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg py-1 z-10 min-w-32">
                <button
                  onClick={deletePost}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            'grid gap-2 mb-3 rounded-xl overflow-hidden',
            post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {post.media_urls.map((url, i) => (
              <img key={i} src={url} alt="" className="w-full h-48 object-cover" />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={toggleLike}
            className={cn(
              'flex items-center gap-1.5 text-sm transition',
              liked ? 'text-red-500' : 'text-slate-500 hover:text-red-500'
            )}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            {likes > 0 && <span>{likes}</span>}
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition"
          >
            <MessageCircle size={16} />
            {post.comments_count > 0 && <span>{post.comments_count}</span>}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition ml-auto"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentSection postId={post.id} />
      )}
    </article>
  )
}

function CommentSection({ postId }: { postId: string }) {
  const { user } = useUser()
  const [comments, setComments] = useState<Array<{
    id: string; content: string; created_at: string;
    author: { username: string; full_name: string; avatar_url: string | null }
  }>>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useState(() => {
    const supabase = createClient()
    supabase
      .from('post_comments')
      .select('id, content, created_at, author:profiles!author_id(username, full_name, avatar_url)')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })
      .limit(10)
      .then(({ data }) => {
        if (data) setComments(data as never)
        setLoading(false)
      })
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, author_id: user.id, content: text.trim() })
      .select('id, content, created_at, author:profiles!author_id(username, full_name, avatar_url)')
      .single()
    if (!error && data) {
      setComments((c) => [...c, data as never])
      setText('')
    }
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
      {loading ? (
        <p className="text-xs text-slate-400">Loading comments…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar src={c.author.avatar_url} name={c.author.full_name} size="sm" />
            <div className="flex-1 bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-white">{c.author.full_name}</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">{c.content}</p>
            </div>
          </div>
        ))
      )}

      {user && (
        <form onSubmit={submit} className="flex gap-2 mt-2">
          <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium disabled:opacity-40"
          >
            Post
          </button>
        </form>
      )}
    </div>
  )
}
