'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Hash, Lock, Megaphone, Pencil, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'
import { formatDate } from '@/lib/utils/formatDate'
import { ChannelAvatar } from '@/components/shared/ChannelAvatar'
import { ChannelAvatarEditor } from '@/components/shared/ChannelAvatarEditor'
import { uploadFile } from '@/lib/utils/uploadFile'
import type { Database } from '@/types/database'

type ChannelType = 'public' | 'private' | 'announcement'
const PAGE_SIZE = 50

const TYPE_ICONS: Record<ChannelType, React.ReactNode> = {
  public: <Hash size={14} />,
  private: <Lock size={14} />,
  announcement: <Megaphone size={14} />,
}

const TYPE_COLORS: Record<ChannelType, string> = {
  public: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  private: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  announcement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function AdminChannelsPage() {
  const { user } = useUser()
  const qc = useQueryClient()
  const { confirm } = useDialog()
  const bannerRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'public' as ChannelType,
    private_join_mode: 'approval' as 'approval' | 'code',
    private_entry_code: '',
    avatar_url: '' as string | null,
    emoji_icon: '' as string | null,
    color_hex: '#7c3aed',
    banner_url: '' as string | null,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [channelsPage, setChannelsPage] = useState(1)

  const { data: channelsResult, isLoading } = useQuery({
    queryKey: ['admin-channels', channelsPage],
    queryFn: async () => {
      const supabase = createClient()
      const from = (channelsPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, count, error } = await supabase
        .from('channels')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return {
        rows: data ?? [],
        total: count ?? 0,
      }
    },
  })
  const channels = channelsResult?.rows ?? []
  const channelsTotal = channelsResult?.total ?? 0
  const channelsTotalPages = Math.max(1, Math.ceil(channelsTotal / PAGE_SIZE))

  type JoinRequest = Database['public']['Tables']['channel_join_requests']['Row'] & {
    channel: { id: string; name: string }
    user: { id: string; full_name: string; username: string }
  }

  type ChannelCreationRequest = Database['public']['Tables']['channel_creation_requests']['Row'] & {
    requester: { id: string; full_name: string; username: string }
  }

  const { data: requests = [] } = useQuery({
    queryKey: ['admin-channel-join-requests', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channel_join_requests')
        .select('id, channel_id, user_id, status, request_note, reviewed_by, reviewed_at, created_at, channel:channels(id, name, created_by), user:profiles!user_id(id, full_name, username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      return ((data ?? []) as unknown as (JoinRequest & { channel: { id: string; name: string; created_by: string } })[])
        .filter((r) => r.channel.created_by === user?.id)
    },
  })

  const { data: channelCreationRequests = [] } = useQuery({
    queryKey: ['admin-channel-creation-requests', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('channel_creation_requests')
        .select('id, requested_by, name, description, type, private_join_mode, private_entry_code, status, review_note, reviewed_by, reviewed_at, created_at, requester:profiles!requested_by(id, full_name, username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      return (data ?? []) as unknown as ChannelCreationRequest[]
    },
  })

  const { mutate: deleteChannel } = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      await supabase.from('channels').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success('Channel deleted')
    },
  })

  const { mutate: reviewJoinRequest, isPending: reviewingRequest } = useMutation({
    mutationFn: async ({ channelId, userId, approve }: { channelId: string; userId: string; approve: boolean }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('review_channel_join_request', {
        p_channel_id: channelId,
        p_user_id: userId,
        p_approve: approve,
      })
      if (error) throw error
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Could not review request')
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-channel-join-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success(vars.approve ? 'Request approved' : 'Request rejected')
    },
    onError: () => toast.error('Failed to review join request'),
  })

  const { mutate: reviewChannelCreationRequest, isPending: reviewingCreationRequest } = useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('review_channel_creation_request', {
        p_request_id: requestId,
        p_approve: approve,
        p_review_note: null,
      })
      if (error) throw error
      const result = data as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error ?? 'Could not review creation request')
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-channel-creation-requests'] })
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
      toast.success(vars.approve ? 'Channel request approved' : 'Channel request rejected')
    },
    onError: () => toast.error('Failed to review channel request'),
  })

  function startEdit(ch: typeof channels[0]) {
    setEditingId(ch.id)
    setForm({
      name: ch.name,
      description: ch.description ?? '',
      type: ch.type as ChannelType,
      private_join_mode: (ch.private_join_mode ?? 'approval') as 'approval' | 'code',
      private_entry_code: ch.private_entry_code ?? '',
      avatar_url: ch.avatar_url ?? '',
      emoji_icon: ch.emoji_icon ?? '',
      color_hex: ch.color_hex ?? '#7c3aed',
      banner_url: ch.banner_url ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ name: '', description: '', type: 'public', private_join_mode: 'approval', private_entry_code: '', avatar_url: '', emoji_icon: '', color_hex: '#7c3aed', banner_url: '' })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (editingId) {
      setSubmitting(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('update_channel_details', {
          p_channel_id: editingId,
          p_description: form.description.trim() || null,
          p_avatar_url: form.avatar_url || null,
          p_emoji_icon: form.emoji_icon || null,
          p_color_hex: form.color_hex || '#7c3aed',
          p_banner_url: form.banner_url || null,
        })
        if (error) throw error
        const result = data as { ok: boolean; error?: string }
        if (!result.ok) throw new Error(result.error ?? 'Failed to update channel')
        toast.success('Channel updated!')
        cancelForm()
        qc.invalidateQueries({ queryKey: ['admin-channels'] })
      } catch (err) {
        toast.error('Failed to update channel')
      } finally {
        setSubmitting(false)
      }
      return
    }
    const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!slug) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: inserted, error } = await supabase.from('channels').insert({
        name: slug,
        description: form.description.trim() || null,
        type: form.type,
        private_join_mode: form.type === 'private' ? form.private_join_mode : 'approval',
        private_entry_code: form.type === 'private' && form.private_join_mode === 'code'
          ? (form.private_entry_code.trim() || null)
          : null,
        avatar_url: form.avatar_url || null,
        emoji_icon: form.emoji_icon || null,
        color_hex: form.color_hex || '#7c3aed',
        banner_url: form.banner_url || null,
        created_by: user!.id,
      }).select('id').single()
      if (error) throw error

      if (inserted?.id) {
        await supabase.from('channel_members').upsert({
          channel_id: inserted.id,
          user_id: user!.id,
          role: 'admin',
        })
      }

      toast.success(`#${slug} created!`)
      cancelForm()
      qc.invalidateQueries({ queryKey: ['admin-channels'] })
    } catch {
      toast.error('Failed to create channel')
    } finally {
      setSubmitting(false)
    }
  }

  const slug = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Channels</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage public chat channels</p>
        </div>
        <button
          onClick={() => { cancelForm(); setShowForm(!showForm) }}
          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors w-full sm:w-auto"
        >
          <Plus size={16} />
          New Channel
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Channel' : 'Create Channel'}</h2>

          {editingId ? (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Hash size={14} />
              <span className="font-mono">{form.name}</span>
              <span className="text-xs text-slate-400">(name cannot be changed)</span>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Channel Name *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">#</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="general"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              {slug && form.name !== slug && (
                <p className="text-xs text-slate-400 mt-1">Will be created as <span className="text-violet-500">#{slug}</span></p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this channel for?"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Type</label>
            <div className="flex gap-3 flex-wrap">
              {(['public', 'private', 'announcement'] as ChannelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    type: t,
                    private_join_mode: t === 'private' ? prev.private_join_mode : 'approval',
                    private_entry_code: t === 'private' ? prev.private_entry_code : '',
                  }))}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                    form.type === t
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {TYPE_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {form.type === 'public' && 'Visible and joinable by all members'}
              {form.type === 'private' && 'Private channel — users join with entry code or admin approval'}
              {form.type === 'announcement' && 'Only admins can post; members can read'}
            </p>

            {form.type === 'private' && (
              <div className="mt-3 space-y-2">
                <label className="block text-sm text-slate-600 dark:text-slate-400">Private join method</label>
                <div className="flex gap-2 flex-wrap">
                  {(['approval', 'code'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, private_join_mode: m })}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                        form.private_join_mode === m
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {form.private_join_mode === 'code' && (
                  <input
                    value={form.private_entry_code}
                    onChange={(e) => setForm({ ...form, private_entry_code: e.target.value })}
                    placeholder="Set entry code"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                )}
              </div>
            )}
          </div>

          {/* Avatar & Banner Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Channel Branding</h3>
            
            {/* Avatar Editor */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Channel Avatar & Icon</h4>
              <ChannelAvatarEditor
                channelId={editingId || 'new'}
                channelName={form.name || 'channel'}
                currentAvatar={form.avatar_url ?? undefined}
                currentEmoji={form.emoji_icon ?? undefined}
                currentColor={form.color_hex || '#7c3aed'}
                isAdmin={true}
                onUpdate={async (data) => {
                  setForm((prev) => ({
                    ...prev,
                    avatar_url: data.avatar_url !== undefined ? (data.avatar_url ?? null) : prev.avatar_url,
                    emoji_icon: data.emoji_icon !== undefined ? (data.emoji_icon ?? null) : prev.emoji_icon,
                    color_hex: data.color_hex !== undefined ? data.color_hex : prev.color_hex,
                  }))
                }}
              />
            </div>

            {/* Banner Upload */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white">Channel Banner</h4>
              
              {form.banner_url && (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.banner_url}
                    alt="channel banner"
                    className="w-full h-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, banner_url: '' }))}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                disabled={uploadingBanner}
                className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-violet-400 dark:hover:border-violet-600 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-2"
              >
                {uploadingBanner ? (
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                ) : (
                  <>
                    <Upload size={20} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Click to upload banner
                    </span>
                    <span className="text-xs text-slate-400">PNG, JPG up to 5MB</span>
                  </>
                )}
              </button>
              
              <input
                ref={bannerRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Banner must be under 5MB')
                    return
                  }

                  setUploadingBanner(true)
                  try {
                    const channelId = editingId || 'new'
                    const path = `${channelId}/banner-${Date.now()}`
                    const banner_url = await uploadFile(file, 'gallery', path)
                    setForm(prev => ({ ...prev, banner_url }))
                    toast.success('Banner uploaded!')
                  } catch {
                    toast.error('Failed to upload banner')
                  } finally {
                    setUploadingBanner(false)
                  }
                }}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Channel'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Channels List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-600" size={28} />
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center">
          <Hash size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No channels yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => {
            const type = ch.type as ChannelType
            return (
              <div
                key={ch.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 w-full">
                  <ChannelAvatar
                    name={ch.name}
                    avatar_url={ch.avatar_url}
                    emoji_icon={ch.emoji_icon}
                    color_hex={ch.color_hex ?? '#7c3aed'}
                    type={ch.type as ChannelType}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">#{ch.name}</p>
                    {ch.description && (
                      <p className="text-xs text-slate-500 truncate">{ch.description}</p>
                    )}
                    <p className="text-xs text-slate-400">{formatDate(ch.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2 shrink-0 w-full sm:w-auto sm:justify-end">
                  {type === 'private' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 capitalize">
                      {ch.private_join_mode ?? 'approval'}
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[type]}`}>
                    {type}
                  </span>
                  <button
                    onClick={() => startEdit(ch)}
                    title="Edit"
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: `Delete #${ch.name}`, message: 'This will permanently delete the channel and all its messages. This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })) deleteChannel(ch.id)
                    }}
                    title="Delete channel"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500">Page {channelsPage} of {channelsTotalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChannelsPage((p) => Math.max(1, p - 1))}
                disabled={channelsPage <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setChannelsPage((p) => Math.min(channelsTotalPages, p + 1))}
                disabled={channelsPage >= channelsTotalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending join requests */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-2">Pending private channel requests</h3>
        {requests.length === 0 ? (
          <p className="text-xs text-slate-400">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                    <span className="font-medium">@{r.user.username}</span> requests to join <span className="font-medium">#{r.channel.name}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{formatDate(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={reviewingRequest}
                    onClick={() => reviewJoinRequest({ channelId: r.channel_id, userId: r.user_id, approve: true })}
                    className="text-xs px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"
                  >
                    Approve
                  </button>
                  <button
                    disabled={reviewingRequest}
                    onClick={() => reviewJoinRequest({ channelId: r.channel_id, userId: r.user_id, approve: false })}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending channel creation requests */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-2">Pending channel creation requests</h3>
        {channelCreationRequests.length === 0 ? (
          <p className="text-xs text-slate-400">No pending channel creation requests.</p>
        ) : (
          <div className="space-y-2">
            {channelCreationRequests.map((r) => (
              <div key={r.id} className="border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-medium">@{r.requester.username}</span> requested <span className="font-medium">#{r.name}</span>
                </p>
                <div className="mt-1 text-xs text-slate-500 space-y-1">
                  <p><span className="text-slate-400">Requester:</span> {r.requester.full_name} (@{r.requester.username})</p>
                  <p><span className="text-slate-400">Created:</span> {formatDate(r.created_at)}</p>
                  <p><span className="text-slate-400">Type:</span> <span className="capitalize">{r.type}</span></p>
                  <p><span className="text-slate-400">Join mode:</span> {r.type === 'private' ? r.private_join_mode : 'N/A (public)'}</p>
                  <p><span className="text-slate-400">Private code:</span> {r.type === 'private' && r.private_join_mode === 'code' ? (r.private_entry_code ?? 'None') : 'N/A'}</p>
                  <p><span className="text-slate-400">Description:</span> {r.description?.trim() ? r.description : 'No description provided'}</p>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    disabled={reviewingCreationRequest}
                    onClick={() => reviewChannelCreationRequest({ requestId: r.id, approve: true })}
                    className="text-xs px-2.5 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium"
                  >
                    Approve
                  </button>
                  <button
                    disabled={reviewingCreationRequest}
                    onClick={() => reviewChannelCreationRequest({ requestId: r.id, approve: false })}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
