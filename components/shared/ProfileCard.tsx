'use client'
import { EnhancedAvatar } from './EnhancedAvatar'
import { UserPlus, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface ProfileCardProps {
  id: string
  username: string
  full_name: string
  avatar_url?: string | null
  bio?: string | null
  level?: string | null
  department?: string | null
  role?: string
  avatar_frame?: string
  banner_url?: string | null
  followerCount?: number
  isFollowing?: boolean
  onFollow?: () => void
  onMessage?: () => void
  showStats?: boolean
  compact?: boolean
}

const levelColors = {
  '100': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  '200': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  '300': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  '400': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
  postgrad: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
}

export function ProfileCard({
  id,
  username,
  full_name,
  avatar_url,
  bio,
  level,
  department,
  role,
  avatar_frame = 'classic',
  banner_url,
  followerCount = 0,
  isFollowing = false,
  onFollow,
  onMessage,
  showStats = false,
  compact = false,
}: ProfileCardProps) {
  if (compact) {
    return (
      <Link
        href={`/profile/${username}`}
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
      >
        <EnhancedAvatar
          src={avatar_url}
          name={full_name}
          size="md"
          frame={avatar_frame as any}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400">
            {full_name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{username}</p>
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Banner */}
      {banner_url ? (
        <div className="h-24 bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600 overflow-hidden">
          <img
            src={banner_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 dark:from-violet-900 dark:via-purple-900 dark:to-pink-900" />
      )}

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="flex items-end gap-4 -mt-8 mb-4">
          <EnhancedAvatar
            src={avatar_url}
            name={full_name}
            size="lg"
            frame={avatar_frame as any}
            className="ring-4 ring-white dark:ring-slate-800"
          />
          <div className="flex-1">
            {role && role !== 'student' && (
              <div className={cn(
                'inline-block px-2 py-1 rounded text-xs font-semibold mb-2',
                role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
              )}>
                {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            )}
          </div>
        </div>

        {/* Name and username */}
        <Link
          href={`/profile/${username}`}
          className="group"
        >
          <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {full_name}
          </h3>
        </Link>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">@{username}</p>

        {/* Bio */}
        {bio && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
            {bio}
          </p>
        )}

        {/* Level and Department */}
        <div className="flex flex-wrap gap-2 mb-4">
          {level && (
            <span className={cn(
              'text-xs font-semibold px-3 py-1 rounded-full',
              levelColors[level as keyof typeof levelColors] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            )}>
              Level {level}
            </span>
          )}
          {department && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {department}
            </span>
          )}
        </div>

        {/* Stats */}
        {showStats && (
          <div className="flex gap-6 py-3 border-y border-slate-200 dark:border-slate-700 mb-4">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{followerCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Followers</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {onFollow || onMessage ? (
          <div className="flex gap-2">
            {onFollow && (
              <button
                onClick={onFollow}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-colors',
                  isFollowing
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                )}
              >
                <UserPlus size={16} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <MessageCircle size={16} />
              </button>
            )}
          </div>
        ) : (
          <Link
            href={`/profile/${username}`}
            className="block w-full text-center py-2 px-3 rounded-lg font-medium text-sm bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-200 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
          >
            View profile
          </Link>
        )}
      </div>
    </div>
  )
}
