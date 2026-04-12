import { cn } from '@/lib/utils/cn'

export function ShimmerBlock({
  className,
  delay = 0,
}: {
  className?: string
  delay?: number
}) {
  return (
    <div
      className={cn('shimmer-block', className)}
      style={{ ['--shimmer-delay' as string]: `${delay}ms` }}
      aria-hidden="true"
    />
  )
}
