'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Avatar } from '@/components/shared/Avatar'
import { Badge } from '@/components/shared/Badge'
import { PostCard } from '@/components/social/PostCard'
import { FeedSkeleton } from '@/components/social/FeedSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { MessageSquare, UserPlus, UserMinus, LayoutGrid } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Profile, PostWithAuthor } from '@/types/app'

export default function ProfilePage({ params }: { params: { username: string } }) {
  const { username } = params
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
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Profile header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start gap-4">
          <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h1>
            <p className="text-slate-400 text-sm">@{profile.username}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {profile.level && <Badge variant="info">Level {profile.level}</Badge>}
              {profile.role !== 'student' && (
                <Badge variant={profile.role === 'super_admin' ? 'danger' : 'warning'}>
                  {profile.role.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{followerCount} followers</p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-4">{profile.bio}</p>
        )}

        {!isMe && me && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => toggleFollow()}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 transition flex items-center justify-center gap-2"
            >
              {isFollowing ? <UserMinus size={15} /> : <UserPlus size={15} />}
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            <button
              onClick={() => router.push(`/chat/dm/${profile.id}`)}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <MessageSquare size={15} />
              Message
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Posts</h2>
        {postsLoading ? (
          <FeedSkeleton />
        ) : !posts || posts.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title="No posts yet"
            description={isMe ? "Share something with the COSSA community!" : `${profile.full_name} hasn't posted yet.`}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
