'use client'
import { EnhancedAvatar } from './EnhancedAvatar'
import { Clock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

interface ProfilePictureHistoryEntry {
  id: string
  avatar_url: string
  uploaded_at: string
  is_current?: boolean
}

interface ProfileGalleryProps {
  pictures: ProfilePictureHistoryEntry[]
  name: string
  avatar_frame?: string
  onSelectPicture?: (picture: ProfilePictureHistoryEntry) => void
  onDeletePicture?: (id: string) => void
  isEditable?: boolean
}

export function ProfileGallery({
  pictures,
  name,
  avatar_frame = 'classic',
  onSelectPicture,
  onDeletePicture,
  isEditable = false,
}: ProfileGalleryProps) {
  if (!pictures || pictures.length === 0) {
    return (
      <div className="p-8 rounded-lg bg-slate-50 dark:bg-slate-900 text-center">
        <Clock className="mx-auto mb-2 text-slate-400 dark:text-slate-600" size={24} />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No profile pictures yet. Upload one to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-violet-600 dark:text-violet-400" />
        <h3 className="font-bold text-slate-900 dark:text-white">Profile Picture History</h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">({pictures.length})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {pictures.map((picture) => (
          <div
            key={picture.id}
            className={cn(
              'group relative rounded-lg overflow-hidden cursor-pointer transition-all',
              picture.is_current ? 'ring-4 ring-violet-500' : 'hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-600'
            )}
            onClick={() => onSelectPicture?.(picture)}
          >
            {/* Image Container */}
            <div className="relative aspect-square bg-gradient-to-br from-violet-200 to-purple-200 dark:from-violet-900 dark:to-purple-900">
              <img
                src={picture.avatar_url}
                alt={`Profile picture from ${new Date(picture.uploaded_at).toLocaleDateString()}`}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 rounded-lg text-xs font-medium"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectPicture?.(picture)
                  }}
                >
                  Use this
                </button>
              </div>

              {/* Current badge */}
              {picture.is_current && (
                <div className="absolute inset-0 pointer-events-none" />
              )}
            </div>

            {/* Info */}
            <div className="p-2 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {new Date(picture.uploaded_at).toLocaleDateString()}
                </p>
                {picture.is_current && (
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Current</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                {new Date(picture.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Delete button */}
            {isEditable && onDeletePicture && !picture.is_current && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this profile picture?')) {
                    onDeletePicture(picture.id)
                  }
                }}
                className="absolute top-1 right-1 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Profile picture comparison view
interface ProfilePictureComparisonProps {
  currentPicture: string
  previousPicture?: string
  name: string
  frame?: string
}

export function ProfilePictureComparison({
  currentPicture,
  previousPicture,
  name,
  frame = 'classic',
}: ProfilePictureComparisonProps) {
  if (!previousPicture) {
    return (
      <div className="text-center">
        <EnhancedAvatar
          src={currentPicture}
          name={name}
          size="xl"
          frame={frame as any}
        />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No previous picture</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 justify-center items-end">
      <div className="text-center">
        <div className="mb-2">
          <EnhancedAvatar
            src={previousPicture}
            name={name}
            size="lg"
            frame={frame as any}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Previous</p>
      </div>

      <div className="text-2xl text-slate-400 dark:text-slate-600">→</div>

      <div className="text-center">
        <div className="mb-2">
          <EnhancedAvatar
            src={currentPicture}
            name={name}
            size="lg"
            frame={frame as any}
            className="ring-2 ring-violet-500"
          />
        </div>
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Current</p>
      </div>
    </div>
  )
}

// Mini stats about profile pictures
interface ProfilePictureStatsProps {
  totalPictures: number
  joinedDate: string
  averageChangeFrequency?: number
}

export function ProfilePictureStats({
  totalPictures,
  joinedDate,
  averageChangeFrequency,
}: ProfilePictureStatsProps) {
  const daysSinceJoin = Math.floor(
    (new Date().getTime() - new Date(joinedDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalPictures}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">Pictures uploaded</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{daysSinceJoin}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">Days member</p>
      </div>
      {averageChangeFrequency !== undefined && (
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {averageChangeFrequency.toFixed(1)}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Days per change</p>
        </div>
      )}
    </div>
  )
}
