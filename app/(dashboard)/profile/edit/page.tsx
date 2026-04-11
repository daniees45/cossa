'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import { useAuthStore } from '@/lib/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { uploadFile } from '@/lib/utils/uploadFile'
import { toast } from 'sonner'
import { Camera, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const LEVELS = ['100', '200', '300', '400', 'postgrad'] as const

export default function EditProfilePage() {
  const router = useRouter()
  const { user } = useUser()
  const setUser = useAuthStore((s) => s.setUser)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    level: (user?.level ?? '') as string,
    department: user?.department ?? 'Computer Science',
  })

  if (!user) return null

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.username.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      let avatar_url = user!.avatar_url

      if (avatarFile) {
        const path = `${user!.id}/avatar-${Date.now()}`
        avatar_url = await uploadFile(avatarFile, 'avatars', path)
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          username: form.username.trim().toLowerCase().replace(/\s+/g, '_'),
          bio: form.bio.trim() || null,
          level: form.level || null,
          department: form.department.trim() || null,
          avatar_url,
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

  const displayAvatar = avatarPreview ?? user.avatar_url
  const initials = user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link
        href={`/profile/${user.username}`}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to profile
      </Link>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Edit Profile</h1>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xl font-bold text-violet-700 dark:text-violet-300 shrink-0">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
              >
                <Camera size={13} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Profile photo</p>
              <p className="text-xs text-slate-500 mt-0.5">JPG, PNG or WebP · Max 2 MB</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your full name"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                placeholder="yourname"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell the community about yourself…"
              rows={3}
              maxLength={160}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{form.bio.length}/160</p>
          </div>

          {/* Level + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select year</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l === 'postgrad' ? 'Postgraduate' : `${l} Level`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Computer Science"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save changes
            </button>
            <Link
              href={`/profile/${user.username}`}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2.5"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
