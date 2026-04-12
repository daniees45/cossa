import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Admin Console" subtitle="Loading controls, reports, and moderation tools..." accentClassName="from-rose-500 to-orange-500" rows={4} />
}
