import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Voting Center" subtitle="Loading ballots, candidates, and election status..." accentClassName="from-emerald-500 to-cyan-500" rows={3} />
}
