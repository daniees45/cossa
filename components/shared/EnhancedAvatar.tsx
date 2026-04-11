'use client'
import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/uploadFile'
import { Crown, Star, Zap } from 'lucide-react'

interface EnhancedAvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  frame?: 'classic' | 'gold' | 'silver' | 'bronze' | 'rainbow' | 'glow' | 'gradient' | 'retro'
  badge?: 'verified' | 'admin' | 'founder' | 'contributor' | 'top'
  showBadge?: boolean
  className?: string
  interactive?: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-32 h-32 text-2xl',
}

const frameBorders = {
  classic: 'ring-2 ring-slate-300 dark:ring-slate-600',
  gold: 'ring-4 ring-yellow-400 dark:ring-yellow-500 shadow-lg shadow-yellow-400/50 dark:shadow-yellow-500/50',
  silver: 'ring-4 ring-slate-400 dark:ring-slate-300 shadow-lg shadow-slate-400/50 dark:shadow-slate-300/50',
  bronze: 'ring-4 ring-amber-600 dark:ring-amber-500 shadow-lg shadow-amber-600/50 dark:shadow-amber-500/50',
  rainbow: 'ring-4 ring-gradient-rainbow shadow-lg shadow-purple-500/50 dark:shadow-purple-500/50',
  glow: 'ring-4 ring-cyan-400 dark:ring-cyan-300 shadow-2xl shadow-cyan-400/50 dark:shadow-cyan-300/50 animate-pulse',
  gradient: 'ring-4 ring-gradient-to-r from-pink-500 via-purple-500 to-blue-500 shadow-lg shadow-purple-500/50',
  retro: 'ring-4 ring-pink-400 dark:ring-pink-500 p-1 border-4 border-yellow-300',
}

const backgroundGradients: Record<string, string> = {
  classic: 'bg-violet-600',
  gold: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
  silver: 'bg-gradient-to-br from-slate-300 to-slate-500',
  bronze: 'bg-gradient-to-br from-amber-500 to-amber-700',
  rainbow: 'bg-gradient-to-br from-pink-400 via-purple-500 to-blue-500',
  glow: 'bg-gradient-to-br from-cyan-400 to-blue-600',
  gradient: 'bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500',
  retro: 'bg-gradient-to-br from-pink-300 to-purple-300',
}

const badgeIcons = {
  verified: { icon: Star, color: 'text-blue-500' },
  admin: { icon: Crown, color: 'text-amber-500' },
  founder: { icon: Crown, color: 'text-purple-500' },
  contributor: { icon: Zap, color: 'text-green-500' },
  top: { icon: Star, color: 'text-red-500' },
}

export function EnhancedAvatar({
  src,
  name,
  size = 'md',
  frame = 'classic',
  badge,
  showBadge = true,
  className,
  interactive = false,
  onClick,
  style,
}: EnhancedAvatarProps) {
  const initials = getInitials(name)
  const BadgeIcon = badge && badgeIcons[badge]?.icon
  const badgeColor = badge ? badgeIcons[badge]?.color : ''

  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden',
        sizes[size],
        backgroundGradients[frame],
        frameBorders[frame],
        interactive && 'cursor-pointer transition-transform hover:scale-110',
        className
      )}
      onClick={onClick}
      style={style}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}

      {/* Badge */}
      {showBadge && badge && BadgeIcon && (
        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow-md ring-2 ring-white dark:ring-slate-800">
          <BadgeIcon size={12} className={cn(badgeColor, 'fill-current')} />
        </div>
      )}
    </div>
  )
}

// Status indicator component for use with avatars
interface AvatarStatusProps {
  status?: 'online' | 'idle' | 'offline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig = {
  sm: { indicator: 'w-2 h-2', position: '-bottom-0.5 -right-0.5' },
  md: { indicator: 'w-3 h-3', position: '-bottom-1 -right-1' },
  lg: { indicator: 'w-4 h-4', position: '-bottom-1.5 -right-1.5' },
}

export function AvatarWithStatus({
  src,
  name,
  status = 'offline',
  size = 'md',
  className,
}: EnhancedAvatarProps & AvatarStatusProps) {
  const config = statusConfig[size as keyof typeof statusConfig]
  const statusColors = {
    online: 'bg-green-500 ring-2 ring-white dark:ring-slate-800',
    idle: 'bg-yellow-500 ring-2 ring-white dark:ring-slate-800',
    offline: 'bg-slate-400 ring-2 ring-white dark:ring-slate-800',
  }

  return (
    <div className="relative inline-block">
      <EnhancedAvatar src={src} name={name} size={size} className={className} />
      {status && (
        <div className={cn('absolute rounded-full', config.position, statusColors[status], config.indicator)} />
      )}
    </div>
  )
}

// Group avatar for teams/channels
interface GroupAvatarProps {
  members: Array<{ name: string; avatar?: string }>
  maxDisplay?: number
  size?: 'md' | 'lg'
  className?: string
}

export function GroupAvatar({ members, maxDisplay = 4, size = 'md', className }: GroupAvatarProps) {
  const displayCount = Math.min(maxDisplay, members.length)
  const extra = members.length - displayCount

  return (
    <div className={cn('flex items-center', className)}>
      {members.slice(0, displayCount).map((member, idx) => (
        <div key={idx} className="-ml-2 first:ml-0">
          <EnhancedAvatar
            src={member.avatar}
            name={member.name}
            size={size}
            className="ring-2 ring-white dark:ring-slate-800"
          />
        </div>
      ))}
      {extra > 0 && (
        <div className={cn(
          'ml-2 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white flex items-center justify-center text-sm font-semibold',
          size === 'md' ? 'w-9 h-9' : 'w-12 h-12'
        )}>
          +{extra}
        </div>
      )}
    </div>
  )
}
