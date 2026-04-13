import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/social/PostCard'
import { CommentsSurface } from '@/components/social/CommentsSurface'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { PostWithAuthor } from '@/types/app'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ postId: string }>
  searchParams?: Promise<{ comments?: string }>
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

export default async function PostPage({ params, searchParams }: Props) {
  const { postId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
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

      <div className="mt-6">
        <CommentsSurface
          postId={postId}
          postHref={`/social/${postId}`}
          initialCommentCount={(data as unknown as { comments_count: number }).comments_count}
          mode="page"
          autoFocusComposer={resolvedSearchParams?.comments === '1'}
        />
      </div>
    </div>
  )
}
