'use client'
import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/uploadFile'
import { Lock, Users } from 'lucide-react'

interface ChannelAvatarProps {
  name: string
  avatar_url?: string | null
  emoji_icon?: string | null
  color_hex?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  type?: 'public' | 'private' | 'announcement'
  className?: string
  onClick?: () => void
  interactive?: boolean
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-3xl',
}

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 32,
  xl: 48,
}

export function ChannelAvatar({
  name,
  avatar_url,
  emoji_icon,
  color_hex = '#7c3aed',
  size = 'md',
  type = 'public',
  className,
  onClick,
  interactive = false,
}: ChannelAvatarProps) {
  const initials = getInitials(name)
  const hasImage = avatar_url || emoji_icon

  const baseStyle: React.CSSProperties = {
    backgroundColor: !avatar_url ? color_hex : undefined,
  }

  return (
    <div
      className={cn(
        'relative rounded-lg flex items-center justify-center text-white font-bold shrink-0 overflow-hidden',
        sizes[size],
        avatar_url ? '' : 'shadow-md',
        interactive && 'cursor-pointer transition-transform hover:scale-105',
        className
      )}
      style={baseStyle}
      onClick={onClick}
    >
      {avatar_url ? (
        <img src={avatar_url} alt={name} className="w-full h-full object-cover" />
      ) : emoji_icon ? (
        <span className={cn('flex items-center justify-center')} style={{ fontSize: `${iconSizes[size]}px` }}>
          {emoji_icon}
        </span>
      ) : (
        initials
      )}

      {/* Type badge */}
      {type === 'private' && (
        <div className="absolute top-0.5 right-0.5 bg-red-500 rounded-full p-0.5 shadow-md">
          <Lock size={size === 'sm' ? 10 : size === 'md' ? 12 : 16} className="text-white" />
        </div>
      )}
      {type === 'announcement' && (
        <div className="absolute top-0.5 right-0.5 bg-blue-500 rounded-full p-0.5 shadow-md">
          <Users size={size === 'sm' ? 10 : size === 'md' ? 12 : 16} className="text-white" />
        </div>
      )}
    </div>
  )
}

// Channel avatar with name for sidebars
interface ChannelAvatarWithNameProps extends ChannelAvatarProps {
  showName?: boolean
  compact?: boolean
}

export function ChannelAvatarWithName({
  name,
  avatar_url,
  emoji_icon,
  color_hex,
  size = 'md',
  type,
  showName = true,
  compact = false,
  className,
  onClick,
  interactive,
}: ChannelAvatarWithNameProps) {
  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-2 group cursor-pointer', className)}
        onClick={onClick}
      >
        <ChannelAvatar
          name={name}
          avatar_url={avatar_url}
          emoji_icon={emoji_icon}
          color_hex={color_hex}
          size="sm"
          type={type}
        />
        <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate transition-colors">
          {name}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3 group cursor-pointer', className)} onClick={onClick}>
      <ChannelAvatar
        name={name}
        avatar_url={avatar_url}
        emoji_icon={emoji_icon}
        color_hex={color_hex}
        size={size}
        type={type}
        interactive={interactive}
      />
      {showName && (
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 truncate transition-colors">
            #{name}
          </h3>
          {type && type !== 'public' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {type === 'private' ? '🔒 Private' : '📢 Announcement'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Grid display for multiple channel avatars
interface ChannelGridProps {
  channels: ChannelAvatarProps[]
  size?: 'md' | 'lg'
}

export function ChannelAvatarGrid({ channels, size = 'md' }: ChannelGridProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {channels.map((channel, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <ChannelAvatar {...channel} size={size} interactive />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{channel.name}</span>
        </div>
      ))}
    </div>
  )
}
