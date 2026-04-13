'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Reply,
  X,
  AtSign,
  Hash,
  ImagePlus,
  ChevronDown,
  ChevronRight,
  SendHorizontal,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/Avatar'
import { timeAgo } from '@/lib/utils/formatDate'
import { cn } from '@/lib/utils/cn'
import { useUser } from '@/lib/hooks/useUser'
import { useSearchParams } from 'next/navigation'

type CommentAuthor = {
  username: string
  full_name: string
  avatar_url: string | null
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

type RealtimeCommentInsertRow = {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  author_id: string
}

type CommentsSurfaceProps = {
  postId: string
  postHref: string
  initialCommentCount?: number
  onCommentAdded?: () => void
  mode?: 'overlay' | 'page'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  autoFocusComposer?: boolean
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

function countCommentsInTree(tree: CommentRow[]): number {
  return tree.reduce((total, node) => total + 1 + countCommentsInTree(node.replies ?? []), 0)
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

export function CommentsSurface({
  postId,
  postHref,
  initialCommentCount = 0,
  onCommentAdded,
  mode = 'overlay',
  open = false,
  onOpenChange,
  autoFocusComposer = false,
}: CommentsSurfaceProps) {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const isOverlay = mode === 'overlay'
  const isVisible = isOverlay ? open : true
  const [comments, setComments] = useState<CommentRow[]>([])
  const [displayCount, setDisplayCount] = useState(initialCommentCount)
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
  const submittedRef = useRef(new Set<string>())
  const onCommentAddedRef = useRef(onCommentAdded)
  const highlightedCommentId = searchParams.get('comment') || searchParams.get('commentId') || searchParams.get('c')

  useEffect(() => { onCommentAddedRef.current = onCommentAdded }, [onCommentAdded])
  useEffect(() => { setDisplayCount(initialCommentCount) }, [initialCommentCount])

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
  }, [text, replyingTo, isVisible])

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
      const resolved = (data ?? []) as unknown as CommentRow[]
      setComments(resolved)
      setDisplayCount(initialCommentCount || countCommentsInTree(resolved))
      setLoading(false)
    }

    void loadComments()

    const realtimeChannel = supabase
      .channel(`comments-${postId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const row = payload.new as RealtimeCommentInsertRow
          const newId = row.id

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
          setDisplayCount((current) => current + 1)

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
        const typingName = data.name

        if (typingTimeoutsRef.current[data.userId]) {
          clearTimeout(typingTimeoutsRef.current[data.userId])
        }

        if (data.active !== false) {
          setTypingUsers((current) => (current.includes(typingName) ? current : [...current, typingName]))
          typingTimeoutsRef.current[data.userId] = setTimeout(() => {
            setTypingUsers((current) => current.filter((name) => name !== typingName))
            delete typingTimeoutsRef.current[data.userId as string]
          }, 2200)
        } else {
          setTypingUsers((current) => current.filter((name) => name !== typingName))
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
  }, [initialCommentCount, postId, user?.id])

  useEffect(() => {
    if (!isOverlay || !isVisible) return

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [isOverlay, isVisible])

  useEffect(() => {
    if (!isVisible || !autoFocusComposer) return
    const timer = window.setTimeout(() => focusComposer(), 180)
    return () => window.clearTimeout(timer)
  }, [autoFocusComposer, isVisible])

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

  function closeSurface() {
    if (!isOverlay) return
    if (text.trim()) {
      toast.success('Draft saved')
    }
    setMobileInputFocused(false)
    onOpenChange?.(false)
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
    setDisplayCount((current) => current + 1)
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
      setDisplayCount((current) => Math.max(0, current - 1))
      setText(trimmed)
      setReplyingTo(currentReplyTarget)
      toast.error('Failed to send comment. Please try again.')
      return
    }

    const newComment = data as unknown as CommentRow
    submittedRef.current.add(newComment.id)
    setComments((current) => replaceCommentInTree(current, tempId, newComment))
  }

  const body = (
    <div className={cn('flex min-h-0 flex-1 flex-col', isOverlay && 'overflow-hidden')}>
      <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-700 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Conversation</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{displayCount} {displayCount === 1 ? 'comment' : 'comments'}</p>
          </div>
          <div className="flex items-center gap-2">
            {isOverlay && (
              <Link
                href={`${postHref}?comments=1`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300"
              >
                <ExternalLink size={13} /> Open page
              </Link>
            )}
            {isOverlay && (
              <button
                type="button"
                onClick={closeSurface}
                aria-label="Close comments"
                className="rounded-xl border border-slate-200/80 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={cn(
        'subtle-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-slate-100 bg-slate-50/55 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/45 sm:px-5 sm:py-5',
        user && isOverlay && 'pb-[calc(var(--mobile-nav-height)+6.4rem)] md:pb-5'
      )}>
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
            {comments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-5 text-center text-sm text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
                No comments yet. Start the conversation.
              </div>
            ) : comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
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
              {isOverlay && (mobileInputFocused || keyboardOpen) && (
                <motion.div
                  key="mobile-comment-composer"
                  initial={{ opacity: 0, y: 22, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed bottom-[calc(var(--mobile-nav-height)+0.3rem)] left-3 right-3 z-[49] rounded-2xl border border-slate-300/90 bg-white/95 px-2.5 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.14)] backdrop-blur dark:border-slate-600 dark:bg-slate-800/95 md:hidden"
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

            {isOverlay && !(mobileInputFocused || keyboardOpen) && (
              <button
                type="button"
                onClick={() => {
                  setMobileInputFocused(true)
                  setTimeout(() => mobileInputRef.current?.focus(), 10)
                }}
                className="fixed bottom-[calc(var(--mobile-nav-height)+0.3rem)] left-3 right-3 z-[49] flex h-11 items-center justify-between rounded-2xl border border-slate-300/90 bg-white/95 px-3 text-sm text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-300 md:hidden"
                aria-label="Open comment composer"
              >
                <span>{replyingTo ? `Reply to @${replyingTo.name}` : 'Add a comment...'}</span>
                <SendHorizontal size={16} className="text-violet-600" />
              </button>
            )}

            <div className={cn('items-end gap-2', isOverlay ? 'hidden md:flex' : 'flex')}>
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
    </div>
  )

  if (!isOverlay) {
    return (
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {body}
      </section>
    )
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center px-0 pb-0 pt-8 md:items-center md:px-4 md:pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close comments"
            onClick={closeSurface}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-[1] flex h-[min(88dvh,52rem)] w-full flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:h-[min(85dvh,46rem)] md:max-w-2xl md:rounded-[2rem]"
          >
            {body}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
      <div className="min-w-0 flex-1">
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
              onClick={() => setCollapsed((value) => !value)}
              className="flex items-center gap-1 text-[10px] text-slate-400 transition hover:text-slate-600"
            >
              {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              {collapsed ? 'Expand thread' : 'Collapse thread'}
            </button>
          )}
        </div>
        {!collapsed && replies.length > 0 && (
          <div className="mt-0.5 space-y-1.5 sm:mt-1 sm:space-y-2">
            {visibleReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
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