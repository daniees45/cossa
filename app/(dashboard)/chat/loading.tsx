import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Messaging" subtitle="Syncing channels and direct conversations..." accentClassName="from-violet-500 to-cyan-500" rows={5} />
}
