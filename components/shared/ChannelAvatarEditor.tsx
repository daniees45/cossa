'use client'
import { useState, useRef } from 'react'
import { Loader2, Upload, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { ChannelAvatar } from './ChannelAvatar'
import { uploadFile } from '@/lib/utils/uploadFile'

interface ChannelAvatarEditorProps {
  channelId: string
  channelName: string
  currentAvatar?: string | null
  currentEmoji?: string | null
  currentColor?: string
  onUpdate: (data: { avatar_url?: string; emoji_icon?: string; color_hex?: string }) => Promise<void>
  isAdmin?: boolean
}

const EMOJI_SUGGESTIONS = ['🎤', '🎵', '🎮', '🎨', '💻', '📚', '🏆', '🎓', '🔬', '🌟', '💡', '🚀', '📱', '⚡', '🎯']
const COLOR_PRESETS = [
  '#7c3aed', // violet
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
]

export function ChannelAvatarEditor({
  channelId,
  channelName,
  currentAvatar,
  currentEmoji,
  currentColor = '#7c3aed',
  onUpdate,
  isAdmin = true,
}: ChannelAvatarEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'image' | 'emoji' | 'color'>('image')
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji || '')
  const [selectedColor, setSelectedColor] = useState(currentColor)

  if (!isAdmin) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Only channel admins can edit the channel avatar
        </p>
      </div>
    )
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const path = `${channelId}/avatar-${Date.now()}`
      const avatar_url = await uploadFile(file, 'gallery', path)
      await onUpdate({ avatar_url })
      toast.success('Channel avatar updated!')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmojiSelect(emoji: string) {
    setSelectedEmoji(emoji)
    setLoading(true)
    try {
      await onUpdate({ emoji_icon: emoji })
      toast.success('Channel emoji updated!')
    } catch {
      toast.error('Failed to update emoji')
    } finally {
      setLoading(false)
    }
  }

  async function handleColorSelect(color: string) {
    setSelectedColor(color)
    setLoading(true)
    try {
      await onUpdate({ color_hex: color })
      toast.success('Channel color updated!')
    } catch {
      toast.error('Failed to update color')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <ChannelAvatar
          name={channelName}
          avatar_url={currentAvatar}
          emoji_icon={selectedEmoji || undefined}
          color_hex={selectedColor}
          size="lg"
        />
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">#{channelName}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Channel preview</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: 'image', label: 'Upload Image', icon: Upload },
          { id: 'emoji', label: 'Pick Emoji', icon: Zap },
          { id: 'color', label: 'Choose Color', icon: '🎨' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              mode === tab.id
                ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {typeof tab.icon === 'string' ? <span>{tab.icon}</span> : <tab.icon size={16} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Image Upload */}
      {mode === 'image' && (
        <div className="space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-violet-400 dark:hover:border-violet-600 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin text-slate-400" size={24} />
            ) : (
              <>
                <Upload className="text-slate-400" size={24} />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Click to upload or drag & drop
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG up to 2MB
                </p>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageUpload}
            disabled={loading}
          />
          {currentAvatar && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Current: Image avatar
            </p>
          )}
        </div>
      )}

      {/* Emoji Picker */}
      {mode === 'emoji' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                disabled={loading}
                className={cn(
                  'p-3 rounded-lg text-2xl hover:scale-110 transition-transform disabled:opacity-50',
                  selectedEmoji === emoji
                    ? 'bg-violet-100 dark:bg-violet-900 ring-2 ring-violet-500'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {selectedEmoji ? `Selected: ${selectedEmoji}` : 'Choose an emoji'}
          </p>
        </div>
      )}

      {/* Color Picker */}
      {mode === 'color' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                disabled={loading}
                className={cn(
                  'p-4 rounded-lg transition-transform hover:scale-110 disabled:opacity-50',
                  selectedColor === color ? 'ring-2 ring-white dark:ring-slate-900 ring-offset-2 dark:ring-offset-slate-800' : ''
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div
              className="w-8 h-8 rounded-lg"
              style={{ backgroundColor: selectedColor as unknown as React.CSSProperties['backgroundColor'] }}
            />
            <p className="text-sm font-mono text-slate-700 dark:text-slate-300">{selectedColor}</p>
          </div>
        </div>
      )}
    </div>
  )
}
