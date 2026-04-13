'use client'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, MoreHorizontal, Pin, Trash2, X, Reply, Bookmark, Trophy, Laugh, Flag, CalendarDays, ShieldCheck, ExternalLink, AtSign, Hash, ImagePlus, ChevronDown, ChevronRight, SendHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { timeAgo } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import type { PostWithAuthor } from '@/types/app'
import { useUser } from '@/lib/hooks/useUser'
import { useSearchParams } from 'next/navigation'

interface PostCardProps {
  post: PostWithAuthor
  onDeleted?: (id: string) => void
  hideOfficialBadge?: boolean
}

type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'misinformation' | 'other'

function extractFirstUrl(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s<]+/i)
  return match?.[0] ?? null
}

export function PostCard({ post, onDeleted, hideOfficialBadge = false }: PostCardProps) {
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
  const firstUrl = extractFirstUrl(post.content)
  const linkHost = (() => {
    if (!firstUrl) return null
    try {
      return new URL(firstUrl).hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  })()

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
    const shareUrl = `${window.location.origin}/social/${post.id}`
    if (navigator.share) {
      void navigator.share({ title: `${post.author.full_name} on COSSA`, url: shareUrl }).catch(() => {
        navigator.clipboard.writeText(shareUrl)
      })
    } else {
      navigator.clipboard.writeText(shareUrl)
    }
    setSharedPulse(true)
    setTimeout(() => setSharedPulse(false), 420)
    toast.success('Post link ready to share')
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
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.995 }}
          className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/96 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur transition-shadow hover:shadow-[0_20px_44px_rgba(15,23,42,0.1)] dark:border-slate-700/70 dark:bg-slate-800/96"
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
      {post.type === 'event_post' && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-100 dark:border-cyan-800">
          <CalendarDays size={12} className="text-cyan-600" />
          <span className="text-cyan-700 dark:text-cyan-300 text-xs font-medium">Event</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link href={`/profile/${post.author.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar src={post.author.avatar_url} name={post.author.full_name} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold leading-none text-slate-900 dark:text-white">{post.author.full_name}</p>
                {!hideOfficialBadge && ['admin', 'super_admin'].includes(post.author.role) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <ShieldCheck size={10} /> Official
                  </span>
                )}
              </div>
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

        {firstUrl && linkHost && (
          <a
            href={firstUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 transition hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-cyan-700"
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Link preview</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{linkHost}</p>
              <ExternalLink size={14} className="text-slate-400" />
            </div>
          </a>
        )}

        {/* Media */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className={cn(
            'grid gap-2 mb-3 rounded-xl overflow-hidden',
            post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {post.media_urls.map((url, i) => {
              const count = post.media_urls?.length ?? 0
              const mediaClass = cn(
                'w-full object-cover',
                count === 1 && 'h-64 sm:h-80',
                count === 2 && 'h-40 sm:h-48',
                count === 3 && i === 0 && 'col-span-2 h-52 sm:h-64',
                count === 3 && i > 0 && 'h-36 sm:h-44',
                count >= 4 && 'h-36 sm:h-44',
              )
              const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(url)
              return isVideo ? (
                <video key={i} src={url} controls className={mediaClass} />
              ) : (
                <img key={i} src={url} alt="" className={mediaClass} />
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <motion.button
            onClick={toggleLike}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -1 }}
            className={cn(
              'flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition',
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
            className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-700/70 dark:hover:text-cyan-300"
          >
            <motion.span
              animate={showComments ? { rotate: [0, -6, 6, 0] } : undefined}
              transition={{ duration: 0.22 }}
            >
              <MessageCircle size={16} />
            </motion.span>
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </motion.button>

          <Link
            href={`/social/${post.id}`}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200/80 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-violet-600 dark:border-slate-700 dark:hover:bg-slate-700/70"
          >
            <Reply size={16} />
            <span>Thread</span>
          </Link>

          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
            className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-700/70 dark:hover:text-cyan-300"
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
              'ml-auto flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition',
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
  author_id?: string
  content: string
  created_at: string
  parent_id: string | null
  author: CommentAuthor
  optimistic?: boolean
  replies?: CommentRow[]
}

type CommentAuthor = {
  username: string
  full_name: string
  avatar_url: string | null
}

type RealtimeCommentInsertRow = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  author_id: string
}

function hasCommentInTree(tree: CommentRow[], commentId: string): boolean {
  for (const node of tree) {
    if (node.id === commentId) return true
    if (node.replies?.length && hasCommentInTree(node.replies, commentId)) return true
  }
  return false
}

function collectAuthorsFromTree(tree: CommentRow[], out: Record<string, CommentAuthor>) {
  for (const node of tree) {
    if (node.author_id) {
      out[node.author_id] = node.author
    }
    if (node.replies?.length) collectAuthorsFromTree(node.replies, out)
  }
}

function addCommentToTree(tree: CommentRow[], comment: CommentRow): CommentRow[] {
  if (!comment.parent_id) return [comment, ...tree]

  let attached = false

  function attach(nodes: CommentRow[]): CommentRow[] {
    return nodes.map((node) => {
      if (node.id === comment.parent_id) {
        attached = true
        return { ...node, replies: [...(node.replies ?? []), comment] }
      }
      if (!node.replies?.length) return node
      return { ...node, replies: attach(node.replies) }
    })
  }

  const next = attach(tree)
  return attached ? next : [comment, ...next]
}

function removeCommentFromTree(tree: CommentRow[], commentId: string): CommentRow[] {
  return tree
    .filter((node) => node.id !== commentId)
    .map((node) => ({
      ...node,
      replies: node.replies ? removeCommentFromTree(node.replies, commentId) : node.replies,
    }))
}

function replaceCommentInTree(tree: CommentRow[], tempId: string, nextComment: CommentRow): CommentRow[] {
  return tree.map((node) => {
    if (node.id === tempId) return nextComment
    if (!node.replies?.length) return node
    return { ...node, replies: replaceCommentInTree(node.replies, tempId, nextComment) }
  })
}

function replaceCommentAuthorInTree(tree: CommentRow[], commentId: string, author: CommentAuthor): CommentRow[] {
  return tree.map((node) => {
    if (node.id === commentId) {
      return { ...node, author }
    }
    if (!node.replies?.length) return node
    return { ...node, replies: replaceCommentAuthorInTree(node.replies, commentId, author) }
  })
}

function CommentSection({ postId, onCommentAdded }: { postId: string; onCommentAdded?: () => void }) {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [mobileInputFocused, setMobileInputFocused] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const mobileInputRef = useRef<HTMLTextAreaElement | null>(null)
  const desktopInputRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingBroadcastAtRef = useRef(0)
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const commentsRef = useRef<CommentRow[]>([])
  const authorCacheRef = useRef<Record<string, CommentAuthor>>({})
  // Track IDs submitted by current user to avoid double-counting via realtime
  const submittedRef = useRef(new Set<string>())
  const onCommentAddedRef = useRef(onCommentAdded)
  const highlightedCommentId = searchParams.get('comment') || searchParams.get('commentId') || searchParams.get('c')

  useEffect(() => { onCommentAddedRef.current = onCommentAdded }, [onCommentAdded])

  useEffect(() => {
    commentsRef.current = comments
    const nextCache: Record<string, CommentAuthor> = { ...authorCacheRef.current }
    collectAuthorsFromTree(comments, nextCache)
    authorCacheRef.current = nextCache
  }, [comments])

  useEffect(() => {
    if (!user) return
    authorCacheRef.current[user.id] = {
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    }
  }, [user])

  useEffect(() => {
    const autosize = (el: HTMLTextAreaElement | null, maxHeight: number) => {
      if (!el) return
      el.style.height = '0px'
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    }
    autosize(mobileInputRef.current, 120)
    autosize(desktopInputRef.current, 210)
  }, [text, replyingTo])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const baselineHeight = viewport.height
    const onResize = () => {
      setKeyboardOpen(viewport.height < baselineHeight - 120)
    }

    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

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
      .channel(`comments-${postId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const row = payload.new as RealtimeCommentInsertRow
          const newId = row.id

          // Own comments are already in local state via optimistic insert + server replace.
          // Skip full tree refetch to avoid redundant network work.
          if (submittedRef.current.has(newId)) {
            submittedRef.current.delete(newId)
            return
          }

          if (hasCommentInTree(commentsRef.current, newId)) {
            return
          }

          const cachedAuthor = authorCacheRef.current[row.author_id]
          const realtimeComment: CommentRow = {
            id: row.id,
            author_id: row.author_id,
            content: row.content,
            created_at: row.created_at,
            parent_id: row.parent_id,
            author: cachedAuthor ?? {
              username: 'user',
              full_name: 'User',
              avatar_url: null,
            },
            replies: [],
          }

          setComments((current) => addCommentToTree(current, realtimeComment))

          if (!cachedAuthor) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('id', row.author_id)
              .single()

            if (profile) {
              const author: CommentAuthor = {
                username: profile.username,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
              authorCacheRef.current[row.author_id] = author
              setComments((current) => replaceCommentAuthorInTree(current, row.id, author))
            }
          }

          onCommentAddedRef.current?.()
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const data = payload as { userId?: string; name?: string; active?: boolean }
        if (!data?.userId || !data?.name || data.userId === user?.id) return

        if (typingTimeoutsRef.current[data.userId]) {
          clearTimeout(typingTimeoutsRef.current[data.userId])
        }

        if (data.active !== false) {
          setTypingUsers((current) => (current.includes(data.name as string) ? current : [...current, data.name as string]))
          typingTimeoutsRef.current[data.userId] = setTimeout(() => {
            setTypingUsers((current) => current.filter((name) => name !== data.name))
            delete typingTimeoutsRef.current[data.userId as string]
          }, 2200)
        } else {
          setTypingUsers((current) => current.filter((name) => name !== data.name))
          delete typingTimeoutsRef.current[data.userId]
        }
      })
      .subscribe()

    typingChannelRef.current = realtimeChannel

    return () => {
      Object.values(typingTimeoutsRef.current).forEach((timeout) => clearTimeout(timeout))
      typingTimeoutsRef.current = {}
      typingChannelRef.current = null
      supabase.removeChannel(realtimeChannel)
    }
  }, [postId, user?.id])

  function broadcastTyping(active: boolean) {
    if (!user || !typingChannelRef.current) return
    void typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        name: user.username,
        active,
      },
    })
  }

  function handleTypingChange(nextText: string) {
    setText(nextText)
    const now = Date.now()
    if (nextText.trim().length > 0 && now - typingBroadcastAtRef.current > 900) {
      typingBroadcastAtRef.current = now
      broadcastTyping(true)
    }
    if (nextText.trim().length === 0) {
      broadcastTyping(false)
    }
  }

  function focusComposer() {
    if (window.matchMedia('(max-width: 767px)').matches) {
      mobileInputRef.current?.focus()
      return
    }
    desktopInputRef.current?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return

    const trimmed = text.trim()
    const currentReplyTarget = replyingTo
    const tempId = `temp-${Date.now()}`
    const optimisticComment: CommentRow = {
      id: tempId,
      author_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
      parent_id: currentReplyTarget?.id ?? null,
      author: {
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
      optimistic: true,
      replies: [],
    }

    setComments((current) => addCommentToTree(current, optimisticComment))
    setText('')
    setReplyingTo(null)
    setMobileInputFocused(false)
    broadcastTyping(false)
    onCommentAdded?.()

    const supabase = createClient()
    const { data, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: trimmed,
        parent_id: currentReplyTarget?.id ?? null,
      })
      .select('id, author_id, content, created_at, parent_id, author:profiles!author_id(username, full_name, avatar_url)')
      .single()

    if (error || !data) {
      setComments((current) => removeCommentFromTree(current, tempId))
      setText(trimmed)
      setReplyingTo(currentReplyTarget)
      toast.error('Failed to send comment. Please try again.')
      return
    }

    const newComment = data as unknown as CommentRow
    submittedRef.current.add(newComment.id)
    setComments((current) => replaceCommentInTree(current, tempId, newComment))
  }

  return (
    <div className={cn(
      'border-t border-slate-100 bg-slate-50/55 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/45 sm:px-5 sm:py-5',
      user && 'pb-[calc(var(--mobile-nav-height)+6.4rem)] md:pb-5'
    )}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Conversation</p>
        <p className="text-xs text-slate-400">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className={cn('flex gap-2.5', idx > 0 && 'ml-5 sm:ml-8')}>
              <div className="h-7 w-7 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-9 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              highlightedCommentId={highlightedCommentId}
              onReply={(id, name) => {
                setReplyingTo({ id, name })
                setText('')
                focusComposer()
              }}
            />
          ))}
        </div>
      )}

      {typingUsers.length > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-700 dark:border-cyan-800/80 dark:bg-cyan-900/20 dark:text-cyan-300">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:-160ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:-80ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500" />
          </span>
          <span>
            {typingUsers.slice(0, 2).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing
          </span>
        </div>
      )}

      {user && (
        <form onSubmit={submit} className="mt-4">
          {replyingTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-700/50">
              <Reply size={12} className="text-violet-500" />
              <span>Replying to <strong className="text-slate-700 dark:text-slate-300">@{replyingTo.name}</strong></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            </div>
          )}
          <AnimatePresence>
            {(mobileInputFocused || keyboardOpen) && (
              <motion.div
                key="mobile-comment-composer"
                initial={{ opacity: 0, y: 22, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'fixed left-3 right-3 z-[49] rounded-2xl border border-slate-300/90 bg-white/95 px-2.5 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.14)] backdrop-blur dark:border-slate-600 dark:bg-slate-800/95 md:hidden',
                  'bottom-[calc(var(--mobile-nav-height)+0.3rem)]'
                )}
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-700">
                    <textarea
                      ref={mobileInputRef}
                      value={text}
                      onChange={(e) => handleTypingChange(e.target.value)}
                      onFocus={() => {
                        setMobileInputFocused(true)
                        text.trim() && broadcastTyping(true)
                      }}
                      onBlur={() => {
                        setTimeout(() => setMobileInputFocused(false), 120)
                        broadcastTyping(false)
                      }}
                      placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add to the conversation...'}
                      rows={1}
                      className="max-h-[120px] min-h-[38px] w-full resize-none bg-transparent px-1.5 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
                    />
                    <div className="mt-1.5 flex items-center gap-1 text-slate-400">
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white hover:text-cyan-600 dark:hover:bg-slate-600" aria-label="Mention user">
                        <AtSign size={16} />
                      </button>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white hover:text-cyan-600 dark:hover:bg-slate-600" aria-label="Add hashtag">
                        <Hash size={16} />
                      </button>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white hover:text-cyan-600 dark:hover:bg-slate-600" aria-label="Attach image">
                        <ImagePlus size={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    aria-label={replyingTo ? 'Send reply' : 'Send comment'}
                    className="mb-[2px] flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 disabled:opacity-40"
                  >
                    <SendHorizontal size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!(mobileInputFocused || keyboardOpen) && (
            <button
              type="button"
              onClick={() => {
                setMobileInputFocused(true)
                setTimeout(() => mobileInputRef.current?.focus(), 10)
              }}
              className="fixed left-3 right-3 z-[49] flex h-11 items-center justify-between rounded-2xl border border-slate-300/90 bg-white/95 px-3 text-sm text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-300 md:hidden"
              style={{ bottom: 'calc(var(--mobile-nav-height) + 0.3rem)' }}
              aria-label="Open comment composer"
            >
              <span>{replyingTo ? `Reply to @${replyingTo.name}` : 'Add a comment...'}</span>
              <SendHorizontal size={16} className="text-violet-600" />
            </button>
          )}

          <div className="hidden items-end gap-2 md:flex">
            <Avatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
              <textarea
                ref={desktopInputRef}
                value={text}
                onChange={(e) => handleTypingChange(e.target.value)}
                onFocus={() => text.trim() && broadcastTyping(true)}
                onBlur={() => broadcastTyping(false)}
                placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Write a thoughtful comment...'}
                rows={2}
                className="max-h-[210px] min-h-[42px] w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700" aria-label="Mention user">
                    <AtSign size={14} />
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700" aria-label="Add hashtag">
                    <Hash size={14} />
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-700" aria-label="Attach image">
                    <ImagePlus size={14} />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!text.trim()}
                  aria-label={replyingTo ? 'Send reply' : 'Send comment'}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 disabled:opacity-40"
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function CommentItem({ comment, onReply, depth = 0, highlightedCommentId }: {
  comment: CommentRow
  onReply: (id: string, username: string) => void
  depth?: number
  highlightedCommentId?: string | null
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [highlightPulse, setHighlightPulse] = useState(comment.id === highlightedCommentId)
  const replies = comment.replies ?? []
  const visibleReplies = showAllReplies ? replies : replies.slice(0, 2)
  const hiddenReplyCount = Math.max(0, replies.length - visibleReplies.length)
  const indentDepth = Math.min(depth, 2)

  useEffect(() => {
    if (comment.id !== highlightedCommentId) return
    setHighlightPulse(true)
    const timeout = setTimeout(() => setHighlightPulse(false), 2600)
    return () => clearTimeout(timeout)
  }, [comment.id, highlightedCommentId])

  return (
    <div
      className={cn('flex items-start gap-2 sm:gap-2.5', depth > 0 && 'mt-1.5 sm:mt-2')}
      style={{ marginLeft: depth > 0 ? `${8 + indentDepth * 12}px` : 0 }}
    >
      <Avatar src={comment.author.avatar_url} name={comment.author.full_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className={cn(
          'rounded-2xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 shadow-sm transition dark:border-slate-700 dark:bg-slate-800/90 sm:px-3 sm:py-2',
          depth > 0 && 'relative before:absolute before:-left-3 before:top-2 before:h-[calc(100%-8px)] before:w-px before:bg-slate-200 dark:before:bg-slate-700',
          comment.optimistic && 'opacity-80',
          highlightPulse && 'ring-2 ring-cyan-300/70 dark:ring-cyan-700/70'
        )}>
          <p className="text-[11px] font-semibold text-slate-800 dark:text-white sm:text-xs">{comment.author.full_name}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            @{comment.author.username} · {comment.optimistic ? 'Sending...' : timeAgo(comment.created_at)}
          </p>
          <p className="mt-1 break-words text-[13px] leading-5 text-slate-700 dark:text-slate-200 sm:text-sm sm:leading-6">{comment.content}</p>
        </div>
        <div className="ml-1 mt-0.5 flex items-center gap-2.5 sm:mt-1 sm:gap-3">
          <button
            onClick={() => onReply(comment.id, comment.author.username)}
            className="flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-violet-600"
          >
            <Reply size={11} /> Reply
          </button>
          {replies.length > 0 && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-slate-600"
            >
              {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              {collapsed ? 'Expand thread' : 'Collapse thread'}
            </button>
          )}
        </div>
        {!collapsed && replies.length > 0 && (
          <div className="mt-0.5 space-y-1.5 sm:mt-1 sm:space-y-2">
            {visibleReplies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                onReply={onReply}
                depth={depth + 1}
                highlightedCommentId={highlightedCommentId}
              />
            ))}
            {hiddenReplyCount > 0 && (
              <button
                onClick={() => setShowAllReplies(true)}
                className="ml-1 rounded-lg px-2 py-1 text-[11px] text-cyan-700 transition hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-900/20"
              >
                View {hiddenReplyCount} more {hiddenReplyCount === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
