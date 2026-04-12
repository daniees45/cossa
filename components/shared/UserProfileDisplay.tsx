'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { EnhancedAvatar } from './EnhancedAvatar'
import { AvatarFrameDisplay } from './AvatarFrame'
import { ProfileGallery } from './ProfileGallery'
import { cn } from '@/lib/utils/cn'
import { User, Image as ImageIcon, Award } from 'lucide-react'

interface UserProfileDisplayProps {
  userId: string
  showGallery?: boolean
  showFrames?: boolean
  className?: string
}

type TabValue = 'profile' | 'frames' | 'gallery'

export function UserProfileDisplay({
  userId,
  showGallery = true,
  showFrames = true,
  className,
}: UserProfileDisplayProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('profile')
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-with-badges', userId],
    queryFn: async () => {
      const supabase = createClient()
      const [profileRes, framesRes, picturesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('avatar_frames').select('*').eq('user_id', userId),
        supabase.from('profile_pictures_history').select('*').eq('user_id', userId).order('uploaded_at', { ascending: false }),
      ])
      
      return {
        profile: profileRes.data,
        frames: framesRes.data || [],
        pictures: picturesRes.data || [],
      }
    },
  })

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-slate-200 dark:bg-slate-700 rounded-lg" />
  }

  if (!profile?.profile) {
    return <div className="p-4 text-center text-slate-500">Profile not found</div>
  }

  const { profile: p, frames, pictures } = profile
  const tabOptions = [
    { value: 'profile' as TabValue, label: 'Profile', icon: User },
    ...(showFrames ? [{ value: 'frames' as TabValue, label: 'Frames', icon: Award }] : []),
    ...(showGallery ? [{ value: 'gallery' as TabValue, label: 'Gallery', icon: ImageIcon }] : []),
  ]

  return (
    <div className={cn('w-full', className)}>
      {/* Tab Navigation */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-1 dark:border-slate-700">
        {tabOptions.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
              )}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Banner */}
            {p.banner_url && (
              <div className="h-24 overflow-hidden rounded-lg sm:h-32">
                <img
                  src={p.banner_url}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Avatar and Info */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <EnhancedAvatar
                src={p.avatar_url}
                name={p.full_name}
                size="xl"
                frame={(p.avatar_frame ?? 'classic') as any}
                className="mx-auto shrink-0 sm:mx-0"
              />
              
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {p.full_name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{p.username}</p>
                
                {p.bio && (
                  <p className="mt-2 text-sm text-slate-600 line-clamp-4 dark:text-slate-300">
                    {p.bio}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {p.level && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Level {p.level}
                    </span>
                  )}
                  {p.department && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {p.department}
                    </span>
                  )}
                  {p.role !== 'student' && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      {p.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showFrames && activeTab === 'frames' && (
          <div>
            <AvatarFrameDisplay
              avatar_url={p.avatar_url}
              name={p.full_name}
              current_frame={(p.avatar_frame ?? 'classic')}
              available_frames={frames as any[]}
              showSelector={false}
            />
            {frames.length === 0 && (
              <div className="p-4 text-center text-slate-500">
                No achievement frames yet
              </div>
            )}
          </div>
        )}

        {showGallery && activeTab === 'gallery' && (
          <ProfileGallery
            pictures={pictures}
            name={p.full_name}
            avatar_frame={(p.avatar_frame ?? 'classic') as any}
          />
        )}
      </div>
    </div>
  )
}
