'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Image as ImageIcon, Upload } from 'lucide-react'
import { useDialog } from '@/components/shared/DialogProvider'

type GalleryItem = {
  name: string
  url: string
}

export default function AdminGalleryPage() {
  const qc = useQueryClient()
  const { confirm } = useDialog()
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['admin-gallery'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from('gallery').list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (error) throw error
      return (data ?? [])
        .filter((f) => f.name !== '.emptyFolderPlaceholder')
        .map((f): GalleryItem => ({
          name: f.name,
          url: supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl,
        }))
    },
  })

  const { mutate: deletePhoto } = useMutation({
    mutationFn: async (name: string) => {
      setDeleting(name)
      const supabase = createClient()
      const { error } = await supabase.storage.from('gallery').remove([name])
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gallery'] })
      toast.success('Photo deleted')
    },
    onError: () => toast.error('Failed to delete photo'),
    onSettled: () => setDeleting(null),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    const supabase = createClient()
    let success = 0
    let failed = 0
    try {
      await Promise.all(
        files.map(async (file) => {
          const name = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`
          const { error } = await supabase.storage.from('gallery').upload(name, file, {
            cacheControl: '3600',
            upsert: false,
          })
          if (error) failed++
          else success++
        })
      )
      if (success > 0) {
        toast.success(`${success} photo${success > 1 ? 's' : ''} uploaded`)
        qc.invalidateQueries({ queryKey: ['admin-gallery'] })
      }
      if (failed > 0) toast.error(`${failed} upload${failed > 1 ? 's' : ''} failed`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gallery</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage photos shown in the Entertainment gallery</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors w-full sm:w-auto"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? 'Uploading…' : 'Upload Photos'}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleUpload}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-16 cursor-pointer hover:border-violet-400 transition-colors"
        >
          <ImageIcon size={36} className="text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">No photos yet</p>
          <p className="text-slate-400 text-xs mt-1">Click to upload the first photos</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.name} className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={async () => {
                      if (await confirm({ title: 'Delete photo', message: 'This will permanently remove this photo from the gallery.', confirmLabel: 'Delete', variant: 'danger' })) deletePhoto(photo.name)
                    }}
                    disabled={deleting === photo.name}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    {deleting === photo.name
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
