'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Crop, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

interface ProfilePictureUploaderProps {
  currentImage?: string | null
  onUpload: (file: File, croppedBlob?: Blob) => Promise<void>
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showCropper?: boolean
  aspectRatio?: number
}

const sizeConfig = {
  sm: { container: 'w-12 h-12', icon: 16, button: 'w-5 h-5' },
  md: { container: 'w-20 h-20', icon: 20, button: 'w-6 h-6' },
  lg: { container: 'w-32 h-32', icon: 32, button: 'w-8 h-8' },
}

export function ProfilePictureUploader({
  currentImage,
  onUpload,
  label = 'Profile picture',
  size = 'md',
  showCropper = true,
  aspectRatio = 1,
}: ProfilePictureUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [showCropMode, setShowCropMode] = useState(false)
  const [cropData, setCropData] = useState({ x: 0, y: 0, scale: 1 })
  const [file, setFile] = useState<File | null>(null)
  
  const config = sizeConfig[size]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    if (f.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string)
      setFile(f)
      if (showCropper) {
        setShowCropMode(true)
      }
    }
    reader.readAsDataURL(f)
  }

  const getCroppedImage = useCallback(() => {
    if (!imgRef.current || !canvasRef.current) return null

    const canvas = canvasRef.current
    const img = imgRef.current
    const size = Math.min(img.width, img.height)
    
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const x = (img.width - size) / 2
    const y = (img.height - size) / 2

    ctx.drawImage(img, x, y, size, size, 0, 0, size, size)
    
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
    })
  }, [])

  const handleCropComplete = async () => {
    if (!file) return
    
    setLoading(true)
    try {
      const croppedBlob = await getCroppedImage()
      if (croppedBlob) {
        await onUpload(file, croppedBlob)
      } else {
        await onUpload(file)
      }
      setShowCropMode(false)
      setPreview(null)
      setFile(null)
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipCrop = async () => {
    if (!file) return
    
    setLoading(true)
    try {
      await onUpload(file)
      setShowCropMode(false)
      setPreview(null)
      setFile(null)
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setLoading(false)
    }
  }

  if (showCropMode && preview) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Crop size={20} />
              Crop image
            </h3>
            <button
              onClick={() => {
                setShowCropMode(false)
                setPreview(null)
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={20} />
            </button>
          </div>

          <img
            ref={imgRef}
            src={preview}
            alt="Crop preview"
            className="w-full max-h-64 object-cover rounded-lg mb-4"
            style={{ aspectRatio }}
          />

          <div className="flex gap-3">
            <button
              onClick={handleCropComplete}
              disabled={loading}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Crop size={16} />}
              Crop & upload
            </button>
            <button
              onClick={handleSkipCrop}
              disabled={loading}
              className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Skip
            </button>
          </div>

          <canvas ref={canvasRef} hidden />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      
      <div className="relative group cursor-pointer">
        <div
          className={cn(
            'rounded-full overflow-hidden bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900 flex items-center justify-center text-white font-semibold shrink-0 ring-4 ring-violet-200 dark:ring-violet-800',
            config.container,
            'transition-all group-hover:ring-violet-400 dark:group-hover:ring-violet-600'
          )}
          onClick={() => fileRef.current?.click()}
        >
          {currentImage || preview ? (
            <img
              src={(currentImage || preview) as string}
              alt="Current"
              className="w-full h-full object-cover"
            />
          ) : (
            <Upload size={config.icon} className="opacity-60" />
          )}
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className={cn(
            'absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100',
            config.button
          )}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={config.icon / 2} />
          ) : (
            <Upload size={config.icon / 2} />
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFileSelect}
          disabled={loading}
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        JPG, PNG or WebP · Max 2 MB
      </p>
    </div>
  )
}
