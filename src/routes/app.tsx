import { loadOperatorResources } from '@/core/app/loaders'
import { createFileRoute } from '@tanstack/react-router'
import { OperatorWorkspaceNotFound } from '@/core/app/ui/operator-workspace-not-found'
import { WorkspaceShell } from '@/core/features/workspace/ui/workspace-shell'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => { await loadOperatorResources({ data: '/app/session-check' }) },
  component: WorkspaceShell,
  notFoundComponent: OperatorWorkspaceNotFound,
})
