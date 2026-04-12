'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { useAuthStore } from '@/lib/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/utils/uploadFile'
import { toast } from 'sonner'
import { Camera, Loader2, ArrowLeft, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { ProfilePictureUploader } from '@/components/shared/ProfilePictureUploader'
import { EnhancedAvatar } from '@/components/shared/EnhancedAvatar'
import { cn } from '@/lib/utils/cn'

const LEVELS = ['100', '200', '300', '400', 'postgrad'] as const
const AVATAR_FRAMES = ['classic', 'gold', 'silver', 'bronze', 'rainbow', 'glow', 'gradient', 'retro'] as const

export default function EditProfilePage() {
  const router = useRouter()
  const { user } = useUser()
  const setUser = useAuthStore((s) => s.setUser)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    level: (user?.level ?? '') as string,
    department: user?.department ?? 'Computer Science',
    avatar_frame: (user?.avatar_frame ?? 'classic') as string,
  })

  if (!user) return null

  async function handleAvatarUpload(file: File, croppedBlob?: Blob) {
    setSaving(true)
    try {
      const supabase = createClient()
      const fileToUpload = croppedBlob ? new File([croppedBlob], file.name, { type: 'image/jpeg' }) : file
      const path = `${user!.id}/avatar-${Date.now()}`
      const avatar_url = await uploadFile(fileToUpload, 'avatars', path)

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url })
        .eq('id', user!.id)
        .select()
        .single()

      if (error) throw error

      setUser(data as typeof user)
      toast.success('Profile picture updated!')
    } catch (error) {
      toast.error('Failed to upload picture')
    } finally {
      setSaving(false)
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingBanner(true)
    try {
      const supabase = createClient()
      const path = `${user!.id}/banner-${Date.now()}`
      const banner_url = await uploadFile(file, 'covers', path)

      const { data, error } = await supabase
        .from('profiles')
        .update({ banner_url } as any)
        .eq('id', user!.id)
        .select()
        .single()

      if (error) throw error

      setUser(data as typeof user)
      toast.success('Banner updated!')
    } catch (error) {
      toast.error('Failed to upload banner')
    } finally {
      setUploadingBanner(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.username.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          username: form.username.trim().toLowerCase().replace(/\s+/g, '_'),
          bio: form.bio.trim() || null,
          level: form.level || null,
          department: form.department.trim() || null,
          avatar_frame: form.avatar_frame,
        })
        .eq('id', user!.id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('That username is already taken')
        } else {
          toast.error(error.message)
        }
        return
      }

      setUser(data as typeof user)
      toast.success('Profile updated!')
      router.push(`/profile/${data.username}`)
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
      <Link
        href={`/profile/${user.username}`}
        className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200 sm:mb-6"
      >
        <ArrowLeft size={16} />
        Back to profile
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {/* Banner Section */}
        <div className="group relative h-28 cursor-pointer overflow-hidden bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 dark:from-violet-900 dark:via-purple-900 dark:to-pink-900 sm:h-32">
          {user.banner_url && (
            <img
              src={user.banner_url}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          )}
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {uploadingBanner ? (
              <Loader2 className="animate-spin text-white" size={24} />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white">
                <ImageIcon size={24} />
                <span className="text-sm font-medium">Change banner</span>
              </div>
            )}
          </button>
          <input
            ref={bannerRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleBannerUpload}
            disabled={uploadingBanner}
          />
        </div>

        <div className="p-4 sm:p-6">
          <h1 className="mb-5 text-2xl font-bold text-slate-900 dark:text-white sm:mb-6">Edit Profile</h1>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar and Preview */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Profile Picture</h2>
                <ProfilePictureUploader
                  currentImage={user.avatar_url}
                  onUpload={handleAvatarUpload}
                  size="lg"
                  showCropper={true}
                />
              </div>

              <div className="md:col-span-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Preview</h2>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 flex flex-col items-center gap-4">
                  <EnhancedAvatar
                    src={user.avatar_url}
                    name={user.full_name}
                    size="xl"
                    frame={form.avatar_frame as any}
                  />
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white">{user.full_name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">@{user.username}</p>
                    {form.bio && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{form.bio}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar Frame Selection */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Avatar Frame</h2>
              <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-4">
                {AVATAR_FRAMES.map((frame) => (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => setForm({ ...form, avatar_frame: frame })}
                    className={cn(
                      'p-2 rounded-lg border-2 transition-all text-center',
                      form.avatar_frame === frame
                        ? 'border-violet-600 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                    )}
                  >
                    <EnhancedAvatar
                      src={user.avatar_url}
                      name={user.full_name}
                      size="md"
                      frame={frame as any}
                      className="mx-auto mb-2"
                    />
                    <span className="block truncate text-xs font-medium capitalize text-slate-700 dark:text-slate-300">{frame}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Fields */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Your full name"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    placeholder="yourname"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Tell the community about yourself…"
                  rows={3}
                  maxLength={160}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
                <p className="text-xs text-slate-400 text-right mt-1">{form.bio.length}/160</p>
              </div>

              {/* Level + Department */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">Select year</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l === 'postgrad' ? 'Postgraduate' : `${l} Level`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Department</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="Computer Science"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-2 dark:border-slate-700 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="submit"
                disabled={saving || uploadingBanner}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50 sm:w-auto"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
              <Link
                href={`/profile/${user.username}`}
                className="inline-flex w-full items-center justify-center px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 sm:w-auto"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
