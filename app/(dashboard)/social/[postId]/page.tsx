import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/social/PostCard'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { PostWithAuthor } from '@/types/app'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ postId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('content, author:profiles!author_id(full_name)')
    .eq('id', postId)
    .single()

  if (!data) return { title: 'Post — COSSA' }

  const row = data as unknown as { content: string; author: { full_name: string } | null }
  const author = row.author
  const preview = row.content.slice(0, 100)
  return {
    title: `${author?.full_name ?? 'COSSA'}: ${preview}`,
    description: row.content.slice(0, 160),
  }
}

export default async function PostPage({ params }: Props) {
  const { postId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('posts')
    .select('*, author:profiles!author_id(*)')
    .eq('id', postId)
    .single()

  if (!data) notFound()

  // Check if current user liked this post
  let liked_by_me = false
  if (user) {
    const { data: like } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()
    liked_by_me = !!like
  }

  const post = { ...(data as unknown as Record<string, unknown>), liked_by_me } as unknown as PostWithAuthor

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to feed
      </Link>

      <PostCard post={post} />

      {/* Comments section - full view */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Comments ({(data as unknown as { comments_count: number }).comments_count})
          </h2>
        </div>
        <Comments postId={postId} currentUserId={user?.id} />
      </div>
    </div>
  )
}

type CommentRow = {
  id: string
  content: string
  author: { id: string; username: string; full_name: string; avatar_url: string | null } | null
}

async function Comments({ postId, currentUserId }: { postId: string; currentUserId?: string }) {
  const supabase = await createClient()
  const { data: rawComments } = await supabase
    .from('post_comments')
    .select('*, author:profiles!author_id(id, username, full_name, avatar_url)')
    .eq('post_id', postId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(50)

  const comments = (rawComments ?? []) as unknown as CommentRow[]

  if (comments.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-slate-400">
        No comments yet. Be the first to comment!
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
      {comments.map((comment) => {
        const author = comment.author
        return (
          <li key={comment.id} className="px-4 sm:px-5 py-4 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0 overflow-hidden">
              {author?.avatar_url ? (
                <img src={author.avatar_url} alt={author.full_name} className="w-full h-full object-cover" />
              ) : (
                (author?.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/profile/${author?.username}`}
                  className="text-sm font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400"
                >
                  {author?.full_name}
                </Link>
                <span className="text-xs text-slate-400">@{author?.username}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-words">{comment.content}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
