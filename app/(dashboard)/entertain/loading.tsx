import { FeatureLoadingScreen } from '@/components/shared/FeatureLoadingScreen'

export default function Loading() {
  return <FeatureLoadingScreen title="Entertainment" subtitle="Loading quizzes, media, and highlights..." accentClassName="from-amber-500 to-rose-500" rows={4} />
}
