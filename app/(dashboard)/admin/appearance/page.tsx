'use client'

import { useEffect, useMemo, useState } from 'react'
import { Palette, RotateCcw, Save, UploadCloud } from 'lucide-react'
import { DEFAULT_SITE_BRANDING, type SiteBranding } from '@/lib/siteBranding'
import { useSiteBranding } from '@/lib/hooks/useSiteBranding'
import { toast } from 'sonner'
import { useUser } from '@/lib/hooks/useUser'
import { uploadFile } from '@/lib/utils/uploadFile'

const MAX_LOGO_SIZE_BYTES = 3 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export default function AdminAppearancePage() {
  const { user } = useUser()
  const { branding, loading, updateBranding } = useSiteBranding()
  const [draft, setDraft] = useState<SiteBranding>(branding)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    setDraft(branding)
  }, [branding])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(branding), [draft, branding])

  async function apply() {
    if (saving) return
    setSaving(true)
    try {
      await updateBranding(draft, user?.id)
      toast.success('Global brand settings updated')
    } catch {
      toast.error('Unable to save branding changes')
    } finally {
      setSaving(false)
    }
  }

  function resetDefaults() {
    setDraft(DEFAULT_SITE_BRANDING)
  }

  async function onLogoFileSelected(file: File | null) {
    if (!file || uploadingLogo) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Use PNG, JPG, WEBP, or SVG.')
      return
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error('Logo file is too large. Maximum size is 3MB.')
      return
    }

    setUploadingLogo(true)
    setUploadProgress(8)
    let progressTimer: ReturnType<typeof setInterval> | null = null
    try {
      progressTimer = setInterval(() => {
        setUploadProgress((current) => (current >= 88 ? current : current + 7))
      }, 140)

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `site-branding/logo-${Date.now()}.${ext}`
      const publicUrl = await uploadFile(file, 'covers', path)
      setUploadProgress(100)
      setDraft((prev) => ({ ...prev, logoUrl: publicUrl }))
      toast.success('Logo uploaded. Save changes to publish globally.')
    } catch {
      toast.error('Logo upload failed')
    } finally {
      if (progressTimer) clearInterval(progressTimer)
      setUploadingLogo(false)
      window.setTimeout(() => setUploadProgress(0), 450)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
            <Palette size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Branding & Appearance</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Admins can customize site logo, title, and dashboard background colors.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
          <Field label="Site title">
            <input
              value={draft.siteTitle}
              onChange={(event) => setDraft((prev) => ({ ...prev, siteTitle: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
              placeholder="COSSA"
            />
          </Field>

          <Field label="Site subtitle">
            <input
              value={draft.siteSubtitle}
              onChange={(event) => setDraft((prev) => ({ ...prev, siteSubtitle: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
              placeholder="VVU CS Assoc."
            />
          </Field>

          <Field label="Logo image URL">
            <div className="space-y-2">
              <input
                value={draft.logoUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, logoUrl: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                placeholder="https://..."
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                <UploadCloud size={14} />
                {uploadingLogo ? 'Uploading logo...' : 'Upload logo file'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void onLogoFileSelected(file)
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              {(uploadingLogo || uploadProgress > 0) && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-[width] duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Upload progress: {uploadProgress}%</p>
                </div>
              )}

              <p className="text-[11px] text-slate-400">Accepted: PNG, JPG, WEBP, SVG. Max file size: 3MB.</p>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Light background">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.lightBackground}
                  onChange={(event) => setDraft((prev) => ({ ...prev, lightBackground: event.target.value }))}
                  className="h-10 w-14 rounded-lg border border-slate-200 bg-transparent p-1 dark:border-slate-700"
                />
                <input
                  value={draft.lightBackground}
                  onChange={(event) => setDraft((prev) => ({ ...prev, lightBackground: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </Field>

            <Field label="Dark background">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.darkBackground}
                  onChange={(event) => setDraft((prev) => ({ ...prev, darkBackground: event.target.value }))}
                  className="h-10 w-14 rounded-lg border border-slate-200 bg-transparent p-1 dark:border-slate-700"
                />
                <input
                  value={draft.darkBackground}
                  onChange={(event) => setDraft((prev) => ({ ...prev, darkBackground: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={apply}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Save size={15} /> {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={resetDefaults}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw size={15} /> Reset defaults
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Preview</p>
          <div
            className="mt-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700"
            style={{ backgroundColor: draft.lightBackground }}
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-violet-600 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
                {draft.logoUrl
                  ? <img src={draft.logoUrl} alt="" className="h-full w-full object-cover" />
                  : (draft.siteTitle[0] || 'C').toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{draft.siteTitle || 'COSSA'}</p>
                <p className="text-xs text-slate-500">{draft.siteSubtitle || 'VVU CS Assoc.'}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {loading
              ? 'Loading global brand settings...'
              : 'Brand settings are stored in Supabase and shared across all users/devices.'}
          </p>
        </aside>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  )
}
