'use client'
import { EnhancedAvatar } from './EnhancedAvatar'
import { Crown, Star, Zap, Sparkles, Award, Target, Flame } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AvatarFrameDisplayProps {
  avatar_url?: string | null
  name: string
  current_frame?: string
  available_frames?: Array<{
    type: 'gold' | 'silver' | 'bronze' | 'rainbow' | 'glow' | 'gradient' | 'retro'
    earned_at: string
    reason?: string
  }>
  onSelectFrame?: (frame: string) => void
  showSelector?: boolean
}

const frameInfo = {
  gold: {
    icon: Crown,
    label: 'Gold Frame',
    description: 'Prestigious achievement',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  silver: {
    icon: Star,
    label: 'Silver Frame',
    description: 'Outstanding contribution',
    color: 'text-gray-600 dark:text-gray-300',
  },
  bronze: {
    icon: Award,
    label: 'Bronze Frame',
    description: 'Notable accomplishment',
    color: 'text-amber-700 dark:text-amber-500',
  },
  rainbow: {
    icon: Sparkles,
    label: 'Rainbow Frame',
    description: 'Special milestone',
    color: 'text-purple-600 dark:text-purple-400',
  },
  glow: {
    icon: Zap,
    label: 'Glow Frame',
    description: 'Rising star',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  gradient: {
    icon: Target,
    label: 'Gradient Frame',
    description: 'Creative excellence',
    color: 'text-pink-600 dark:text-pink-400',
  },
  retro: {
    icon: Flame,
    label: 'Retro Frame',
    description: 'Classic vibes',
    color: 'text-pink-600 dark:text-pink-400',
  },
}

export function AvatarFrameDisplay({
  avatar_url,
  name,
  current_frame = 'classic',
  available_frames = [],
  onSelectFrame,
  showSelector = true,
}: AvatarFrameDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Current Frame Display */}
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <EnhancedAvatar
            src={avatar_url}
            name={name}
            size="xl"
            frame={current_frame as any}
          />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Current: <span className="capitalize text-violet-600 dark:text-violet-400">{current_frame}</span> Frame
        </p>
      </div>

      {/* Frame Selector */}
      {showSelector && available_frames.length > 0 && onSelectFrame && (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Your Frames</h4>

          <div className="grid grid-cols-2 gap-3">
            {available_frames.map((frame) => {
              const info = frameInfo[frame.type]
              const Icon = info.icon
              const isActive = current_frame === frame.type

              return (
                <button
                  key={frame.type}
                  onClick={() => onSelectFrame(frame.type)}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all text-left',
                    isActive
                      ? 'border-violet-600 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Icon className={cn('w-4 h-4', info.color)} />
                    {isActive && <span className="text-xs font-bold text-violet-600 dark:text-violet-400">✓</span>}
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{info.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{info.description}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Earned {new Date(frame.earned_at).toLocaleDateString()}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {available_frames.length === 0 && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 text-center">
          <Sparkles className="mx-auto mb-2 text-slate-400 dark:text-slate-600" size={20} />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Earn achievements to unlock special frames!
          </p>
        </div>
      )}
    </div>
  )
}

// Frame showcase gallery
interface FrameShowcaseProps {
  frames: Array<string>
  name: string
  avatar_url?: string | null
  className?: string
}

export function FrameShowcase({
  frames,
  name,
  avatar_url,
  className,
}: FrameShowcaseProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Available Frames</h3>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
        {frames.map((frame) => (
          <div key={frame} className="flex flex-col items-center gap-2">
            <EnhancedAvatar
              src={avatar_url}
              name={name}
              size="md"
              frame={frame as any}
            />
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-900 dark:text-white capitalize">{frame}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Frame</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Achievement badge system
interface AchievementBadgeProps {
  icon: React.ReactNode
  title: string
  description: string
  unlocked: boolean
  unlockedAt?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  onClick?: () => void
}

const rarityColors = {
  common: 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white',
  rare: 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
  epic: 'bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-100',
  legendary: 'bg-yellow-200 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100',
}

const rarityBorders = {
  common: 'border-slate-400',
  rare: 'border-blue-400',
  epic: 'border-purple-400',
  legendary: 'border-yellow-400',
}

export function AchievementBadge({
  icon,
  title,
  description,
  unlocked,
  unlockedAt,
  rarity = 'common',
  onClick,
}: AchievementBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border-2 transition-all text-left',
        unlocked
          ? `${rarityColors[rarity]} cursor-pointer hover:scale-105 ${rarityBorders[rarity]}`
          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-xs opacity-75 mt-0.5">{description}</p>
          {unlocked && unlockedAt && (
            <p className="text-xs opacity-50 mt-1">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
