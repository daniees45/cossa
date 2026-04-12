import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Campus Feed" subtitle="Preparing your timeline and channels..." accentClassName="from-cyan-500 to-blue-500" rows={4} />
}
