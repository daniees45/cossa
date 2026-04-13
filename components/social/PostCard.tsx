'use client'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Heart, MessageCircle, Share2, MoreHorizontal, Pin, Trash2, X, Reply, Bookmark, Trophy, Laugh, Flag, CalendarDays, ShieldCheck, ExternalLink, Repeat2 } from 'lucide-react'
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason | ''>('')
  const [reportNote, setReportNote] = useState('')
  const [reporting, setReporting] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sharedPulse, setSharedPulse] = useState(false)
  const [reposted, setReposted] = useState(false)
  const [reposting, setReposting] = useState(false)
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

  async function handleRepost() {
    if (!user || reposting) return
    setReposting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('posts').insert({
        author_id: user.id,
        type: 'post',
        content: `Repost from @${post.author.username}\n\n${post.content}\n\nOriginal: ${window.location.origin}/social/${post.id}`,
        media_urls: post.media_urls ?? null,
      })
      if (error) throw error
      setReposted(true)
      toast.success('Reposted to your feed')
    } catch {
      toast.error('Unable to repost this post right now')
    } finally {
      setReposting(false)
    }
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

          <Link
            href={`/social/${post.id}?comments=1`}
            className="flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-700/70 dark:hover:text-cyan-300"
          >
            <motion.span
              whileHover={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.22 }}
            >
              <MessageCircle size={16} />
            </motion.span>
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </Link>

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
            onClick={handleRepost}
            disabled={!user || reposting}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
            className={cn(
              'flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm transition',
              reposted
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-emerald-700 dark:hover:bg-slate-700/70 dark:hover:text-emerald-300',
              (!user || reposting) && 'opacity-60'
            )}
          >
            <Repeat2 size={16} />
            <span>{reposting ? 'Reposting...' : reposted ? 'Reposted' : 'Repost'}</span>
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
