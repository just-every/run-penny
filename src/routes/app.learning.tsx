import { createFileRoute } from '@tanstack/react-router'
import { LearningPage } from '@/core/features/learning/ui/learning-page'
import type { LearningTab } from '@/core/features/learning/ui/learning-tabs'
export const Route = createFileRoute('/app/learning')({
 validateSearch: (search: Record<string, unknown>): { tab?: LearningTab; investigation?: string } => ({
  tab: search.tab === 'results' || search.tab === 'learning' || search.tab === 'needs-you' ? search.tab : undefined,
  investigation: typeof search.investigation === 'string' && search.investigation ? search.investigation : undefined,
 }),
 component: LearningPage,
})
