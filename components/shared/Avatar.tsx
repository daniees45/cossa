import { cn } from '@/lib/utils/cn'
import { getInitials } from '@/lib/utils/uploadFile'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <div className={cn(
      'rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden',
      sizes[size],
      className
    )}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}
