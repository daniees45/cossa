'use client'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, MoreHorizontal, Pin, Trash2, X, Reply, Bookmark, Trophy, Laugh, Flag } from 'lucide-react'
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

type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'

export function PostCard({ post, onDeleted }: PostCardProps) {
  const { user } = useUser()
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likes, setLikes] = useState(post.likes_count)
  const [bookmarked, setBookmarked] = useState(post.bookmarked_by_me ?? false)
  const [commentsCount, setCommentsCount] = useState(post.comments_count)
  const [showComments, setShowComments] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | ''>('')
  const [reportNote, setReportNote] = useState('')
  const [reporting, setReporting] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sharedPulse, setSharedPulse] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Sync when React Query cache is updated by realtime (likes/comments from others)
  useEffect(() => { setLikes(post.likes_count) }, [post.likes_count])
  useEffect(() => { setCommentsCount(post.comments_count) }, [post.comments_count])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

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

  async function toggleBookmark() {
    if (!user) return
    const supabase = createClient()
    const next = !bookmarked
    setBookmarked(next)
    if (next) {
      await supabase.from('post_bookmarks').insert({ post_id: post.id, user_id: user.id })
      toast.success('Saved to bookmarks')
    } else {
      await supabase.from('post_bookmarks').delete().match({ post_id: post.id, user_id: user.id })
      toast.success('Removed from bookmarks')
    }
  }

  async function deletePost() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) {
      toast.error('Failed to delete post')
      setDeleting(false)
    } else {
      setConfirmDelete(false)
      setDeleting(false)
      setRemoved(true)
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(`${window.location.origin}/social/${post.id}`)
    setSharedPulse(true)
    setTimeout(() => setSharedPulse(false), 420)
    toast.success('Link copied!')
  }

  async function submitReport() {
    if (!user || !reportReason) return
    setReporting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('post_reports').insert({
        post_id: post.id,
        reporter_id: user.id,
        reason: reportReason,
        note: reportNote.trim() || null,
      })
      if (error) {
        if (error.code === '23505') toast.error('You already reported this post')
        else toast.error(error.message)
        return
      }
      toast.success('Report submitted — thank you')
      setShowReport(false)
      setReportReason('')
      setReportNote('')
    } finally {
      setReporting(false)
    }
  }

  return (
    <AnimatePresence mode="popLayout" onExitComplete={() => onDeleted?.(post.id)}>
      {!removed && (
        <motion.article
          layout
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white/96 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/96"
        >
      {/* Pinned banner */}
      {post.pinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
          <Pin size={12} className="text-violet-600" />
          <span className="text-violet-700 dark:text-violet-300 text-xs font-medium">Pinned post</span>
        </div>
      )}
      {/* Post type badge (non-default types only) */}
      {post.type === 'meme' && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
          <Laugh size={12} className="text-amber-500" />
          <span className="text-amber-600 dark:text-amber-300 text-xs font-medium">Meme</span>
        </div>
      )}
      {post.type === 'achievement' && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800">
          <Trophy size={12} className="text-emerald-500" />
          <span className="text-emerald-600 dark:text-emerald-300 text-xs font-medium">Achievement</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link href={`/profile/${post.author.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar src={post.author.avatar_url} name={post.author.full_name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none text-slate-900 dark:text-white">{post.author.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">@{post.author.username} · {timeAgo(post.created_at)}</p>
            </div>
          </Link>
          {user && (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded-xl border border-slate-200/80 p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <MoreHorizontal size={16} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-10 z-10 min-w-40 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-slate-600 dark:bg-slate-700/95"
                  >
                    {user.id === post.author_id && (
                      <button
                        onClick={() => {
                          setConfirmDelete(true)
                          setMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                    {user.id !== post.author_id && (
                      <button
                        onClick={() => {
                          setShowReport(true)
                          setMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-600"
                      >
                        <Flag size={13} /> Report post
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="mb-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800 dark:text-slate-200"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            'grid gap-2 mb-3 rounded-xl overflow-hidden',
            post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {post.media_urls.map((url, i) => {
              const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(url)
              return isVideo ? (
                <video key={i} src={url} controls className={cn('w-full object-cover', post.media_urls?.length === 1 ? 'h-64 sm:h-80' : 'h-40 sm:h-48')} />
              ) : (
                <img key={i} src={url} alt="" className={cn('w-full object-cover', post.media_urls?.length === 1 ? 'h-64 sm:h-80' : 'h-40 sm:h-48')} />
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <motion.button
            onClick={toggleLike}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
              liked ? 'bg-red-50 text-red-500 dark:bg-red-950/40' : 'text-slate-500 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700/70'
            )}
          >
            <motion.span
              key={liked ? 'liked' : 'unliked'}
              initial={{ scale: 0.8, rotate: liked ? -8 : 8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            </motion.span>
            {likes > 0 && <span>{likes}</span>}
          </motion.button>

          <motion.button
            onClick={() => setShowComments(!showComments)}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-700/70 dark:hover:text-cyan-300"
          >
            <motion.span
              animate={showComments ? { rotate: [0, -6, 6, 0] } : undefined}
              transition={{ duration: 0.22 }}
            >
              <MessageCircle size={16} />
            </motion.span>
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </motion.button>

          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-700/70 dark:hover:text-cyan-300"
          >
            <motion.span
              animate={sharedPulse ? { x: [0, 2, -2, 2, 0], scale: [1, 1.08, 1] } : undefined}
              transition={{ duration: 0.32 }}
            >
              <Share2 size={16} />
            </motion.span>
          </motion.button>

          <motion.button
            onClick={toggleBookmark}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
              bookmarked ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/40' : 'text-slate-500 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-700/70'
            )}
          >
            <motion.span
              key={bookmarked ? 'bookmarked' : 'unbookmarked'}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.18 }}
            >
              <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
            </motion.span>
          </motion.button>
        </div>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentSection postId={post.id} onCommentAdded={() => setCommentsCount((c) => c + 1)} />
      )}

      {/* Report modal */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:px-4 sm:pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/40" onClick={() => setShowReport(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-2xl sm:p-6" initial={{ opacity: 0, y: 22, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <button onClick={() => setShowReport(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <Flag size={18} className="text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Report post</h3>
            <p className="text-sm text-slate-500 mb-4">Why are you reporting this post?</p>
            <div className="space-y-2 mb-4">
              {(['spam', 'inappropriate', 'harassment', 'misinformation', 'other'] as const satisfies ReadonlyArray<ReportReason>).map((r) => (
                <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="accent-violet-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300 capitalize group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </span>
                </label>
              ))}
            </div>
            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Additional details (optional)"
              rows={2}
              className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 resize-none mb-4"
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={submitReport}
                disabled={!reportReason || reporting}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition"
              >
                {reporting ? 'Submitting…' : 'Submit report'}
              </button>
              <button
                onClick={() => setShowReport(false)}
                className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:px-4 sm:pb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:rounded-2xl sm:p-6" initial={{ opacity: 0, y: 22, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <button onClick={() => setConfirmDelete(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Delete post?</h3>
            <p className="text-sm text-slate-500 mb-5">This can&apos;t be undone. The post and all its comments will be permanently removed.</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.article>
      )}
    </AnimatePresence>
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

function CommentSection({ postId, onCommentAdded }: { postId: string; onCommentAdded?: () => void }) {
  const { user } = useUser()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)
  // Track IDs submitted by current user to avoid double-counting via realtime
  const submittedRef = useRef(new Set<string>())
  const onCommentAddedRef = useRef(onCommentAdded)
  useEffect(() => { onCommentAddedRef.current = onCommentAdded }, [onCommentAdded])

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()

    async function loadComments() {
      const { data } = await supabase.rpc('get_post_comments_tree', {
        p_post_id: postId,
        p_limit: 50,
      })
      setComments((data ?? []) as unknown as CommentRow[])
      setLoading(false)
    }

    void loadComments()

    // Live subscription — new comments from other users appear instantly
    const realtimeChannel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const newId = (payload.new as { id: string }).id
          await loadComments()
          if (!submittedRef.current.has(newId)) {
            onCommentAddedRef.current?.()
          }
          submittedRef.current.delete(newId)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(realtimeChannel) }
  }, [postId])

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
      const newComment = data as unknown as CommentRow
      submittedRef.current.add(newComment.id)
      setText('')
      setReplyingTo(null)
      onCommentAdded?.()
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/55 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/45 sm:px-5 sm:py-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Conversation</p>
        <p className="text-xs text-slate-400">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</p>
      </div>

      {loading ? (
        <p className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Loading comments…</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} onReply={(id, name) => { setReplyingTo({ id, name }); setText('') }} />
          ))}
        </div>
      )}

      {user && (
        <form onSubmit={submit} className="mt-4 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/90 sm:p-3.5">
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-700/50">
              <Reply size={12} className="text-violet-500" />
              <span>Replying to <strong className="text-slate-700 dark:text-slate-300">@{replyingTo.name}</strong></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Write a comment…'}
              rows={2}
              className="min-h-[68px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40 sm:w-auto"
            >
              {replyingTo ? 'Reply' : 'Post'}
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
    <div className={cn('flex items-start gap-2.5', depth > 0 && 'ml-4 mt-2 border-l border-slate-200 pl-3 dark:border-slate-700 sm:ml-8')}>
      <Avatar src={comment.author.avatar_url} name={comment.author.full_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <p className="text-xs font-semibold text-slate-800 dark:text-white">{comment.author.full_name}</p>
          <p className="mt-1 break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{comment.content}</p>
        </div>
        <div className="ml-1 mt-1 flex items-center gap-3">
          <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
          {depth === 0 && (
            <button
              onClick={() => onReply(comment.id, comment.author.username)}
              className="flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-violet-600"
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
