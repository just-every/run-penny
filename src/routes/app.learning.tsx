import { createFileRoute } from '@tanstack/react-router'
import { LearningPage } from '@/core/features/learning/ui/learning-page'
export const Route = createFileRoute('/app/learning')({ component: LearningPage })
