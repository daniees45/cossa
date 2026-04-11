'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, MoreHorizontal, Pin, Trash2, X, Reply } from 'lucide-react'
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { toast.error('Failed to delete post'); setDeleting(false) }
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
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <Trash2 size={13} /> Delete
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm shadow-2xl">
            <button onClick={() => setConfirmDelete(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Delete post?</h3>
            <p className="text-sm text-slate-500 mb-5">This can&apos;t be undone. The post and all its comments will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={deletePost}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

type CommentRow = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  author: { username: string; full_name: string; avatar_url: string | null }
  replies?: CommentRow[]
}

function CommentSection({ postId }: { postId: string }) {
  const { user } = useUser()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)

  useState(() => {
    const supabase = createClient()
    supabase
      .from('post_comments')
      .select('id, content, created_at, parent_id, author:profiles!author_id(username, full_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setComments(buildTree(data as CommentRow[]))
        setLoading(false)
      })
  })

  function buildTree(flat: CommentRow[]): CommentRow[] {
    const map = new Map<string, CommentRow>()
    const roots: CommentRow[] = []
    flat.forEach((c) => { map.set(c.id, { ...c, replies: [] }) })
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.replies!.push(c)
      } else {
        roots.push(c)
      }
    })
    return roots
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: text.trim(),
        parent_id: replyingTo?.id ?? null,
      })
      .select('id, content, created_at, parent_id, author:profiles!author_id(username, full_name, avatar_url)')
      .single()
    if (!error && data) {
      const newComment = { ...(data as CommentRow), replies: [] }
      if (replyingTo) {
        setComments((prev) => prev.map((c) =>
          c.id === replyingTo.id
            ? { ...c, replies: [...(c.replies ?? []), newComment] }
            : c
        ))
      } else {
        setComments((c) => [...c, newComment])
      }
      setText('')
      setReplyingTo(null)
    }
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
      {loading ? (
        <p className="text-xs text-slate-400">Loading comments…</p>
      ) : (
        comments.map((c) => (
          <CommentItem key={c.id} comment={c} onReply={(id, name) => { setReplyingTo({ id, name }); setText('') }} />
        ))
      )}

      {user && (
        <form onSubmit={submit} className="flex flex-col gap-2 mt-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg">
              <Reply size={12} className="text-violet-500" />
              <span>Replying to <strong className="text-slate-700 dark:text-slate-300">@{replyingTo.name}</strong></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Write a comment…'}
              className="flex-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function CommentItem({ comment, onReply, depth = 0 }: {
  comment: CommentRow
  onReply: (id: string, username: string) => void
  depth?: number
}) {
  return (
    <div className={cn('flex gap-2.5', depth > 0 && 'ml-8 mt-2')}>
      <Avatar src={comment.author.avatar_url} name={comment.author.full_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl px-3 py-2">
          <p className="text-xs font-semibold text-slate-800 dark:text-white">{comment.author.full_name}</p>
          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">{comment.content}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 ml-1">
          <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
          {depth === 0 && (
            <button
              onClick={() => onReply(comment.id, comment.author.username)}
              className="text-[10px] text-slate-400 hover:text-violet-600 flex items-center gap-1 transition"
            >
              <Reply size={11} /> Reply
            </button>
          )}
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2 mt-1">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} onReply={onReply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
