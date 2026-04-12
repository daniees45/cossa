import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Competitions" subtitle="Pulling challenges and leaderboard details..." accentClassName="from-fuchsia-500 to-cyan-500" rows={3} />
}
