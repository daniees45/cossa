'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Badge } from '@/components/shared/Badge'
import { PostCard } from '@/components/social/PostCard'
import { FeedSkeleton } from '@/components/social/FeedSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { MessageSquare, UserPlus, UserMinus, LayoutGrid, GraduationCap, Share2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Profile, PostWithAuthor } from '@/types/app'
import { use } from 'react'

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const { user: me } = useUser()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['profile-username', username],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*').eq('username', username).single()
      return data as Profile
    },
  })

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', username],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('posts')
        .select('*, author:profiles!author_id(*)')
        .eq('author_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as unknown as PostWithAuthor[]
    },
  })

  const { data: isFollowing } = useQuery({
    queryKey: ['is-following', me?.id, profile?.id],
    enabled: !!me && !!profile && me.id !== profile.id,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('follower_id', me!.id)
        .eq('following_id', profile!.id)
        .maybeSingle()
      return !!data
    },
  })

  const { data: followerCount } = useQuery({
    queryKey: ['follower-count', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profile!.id)
      return count ?? 0
    },
  })

  const { data: followingCount } = useQuery({
    queryKey: ['following-count', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profile!.id)
      return count ?? 0
    },
  })

  const { data: postCount } = useQuery({
    queryKey: ['post-count', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', profile!.id)
      return count ?? 0
    },
  })

  const { mutate: toggleFollow } = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      if (isFollowing) {
        await supabase.from('followers').delete().match({ follower_id: me!.id, following_id: profile!.id })
      } else {
        await supabase.from('followers').insert({ follower_id: me!.id, following_id: profile!.id })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['is-following', me?.id, profile?.id] })
      qc.invalidateQueries({ queryKey: ['follower-count', profile?.id] })
    },
    onError: () => toast.error('Action failed'),
  })

  if (!profile) return null
  const isMe = me?.id === profile.id

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 sm:h-44 md:h-48">
          {profile.banner_url && (
            <img src={profile.banner_url} alt="" className="h-full w-full object-cover object-[center_30%]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
        </div>

        <div className="relative px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-7 flex flex-col gap-4 sm:-mt-11 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-3 sm:gap-4">
              <div className="rounded-2xl border-4 border-white dark:border-slate-800">
                <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
              </div>
              <div className="min-w-0 pb-1.5">
                <h1 className="break-words text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{profile.full_name}</h1>
                <p className="break-all text-sm text-slate-400">@{profile.username}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {profile.level && <Badge variant="info">Level {profile.level}</Badge>}
            {profile.role !== 'student' && (
              profile.role === 'super_admin' ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
                  super admin
                </span>
              ) : (
                <Badge variant="warning">{profile.role.replace('_', ' ')}</Badge>
              )
            )}
            {profile.department && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-700/70 dark:text-slate-300">
                <GraduationCap size={11} />
                {profile.department}
              </span>
            )}
          </div>

          {profile.bio ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{profile.bio}</p>
          ) : (
            <p className="mt-3 text-sm italic text-slate-400">No bio added yet.</p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{postCount ?? '—'}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Posts</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{followerCount ?? '—'}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Followers</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{followingCount ?? '—'}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Following</p>
            </div>
          </div>

          {isMe && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/profile/${profile.username}`
                  if (navigator.share) {
                    try { await navigator.share({ title: profile.full_name, url }) } catch { /* cancelled */ }
                  } else {
                    await navigator.clipboard.writeText(url)
                    toast.success('Profile link copied!')
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300"
              >
                <Share2 size={15} />
                Share
              </button>
              <button
                onClick={() => router.push('/profile/edit')}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300"
              >
                Edit Profile
              </button>
            </div>
          )}

          {!isMe && me && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/profile/${profile.username}`
                  if (navigator.share) {
                    try { await navigator.share({ title: profile.full_name, url }) } catch { /* cancelled */ }
                  } else {
                    await navigator.clipboard.writeText(url)
                    toast.success('Profile link copied!')
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300"
              >
                <Share2 size={15} />
                Share
              </button>
              <button
                onClick={() => toggleFollow()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:text-slate-300"
              >
                {isFollowing ? <UserMinus size={15} /> : <UserPlus size={15} />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={() => router.push(`/chat/dm/${profile.id}`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                <MessageSquare size={15} />
                Message
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Posts</h2>
          <p className="text-xs text-slate-400">Recent activity</p>
        </div>

        {postsLoading ? (
          <FeedSkeleton />
        ) : !posts || posts.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title="No posts yet"
            description={isMe ? 'Share something with the COSSA community!' : `${profile.full_name} hasn't posted yet.`}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => <PostCard key={p.id} post={p} hideOfficialBadge={isMe} />)}
          </div>
        )}
      </section>
    </div>
  )
}
