import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Information Hub" subtitle="Fetching notices, resources, and updates..." accentClassName="from-cyan-500 to-sky-500" rows={5} />
}
