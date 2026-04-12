import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Profile" subtitle="Preparing profile details and activity..." accentClassName="from-violet-500 to-fuchsia-500" rows={3} />
}
