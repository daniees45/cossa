import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Social" subtitle="Loading post details and discussion thread..." accentClassName="from-cyan-500 to-violet-500" rows={3} />
}
