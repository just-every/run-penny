import type { Hono } from 'hono'
import type { OperatorMutationEnvironment } from '@/core/app/operator-mutations'
import { registerCustomFieldDefinitionRoutes } from './custom-field-definitions'
import { registerCustomFieldValueRoutes } from './custom-field-values'

export function registerCustomFieldRoutes(app: Hono<OperatorMutationEnvironment>): void {
  registerCustomFieldDefinitionRoutes(app)
  registerCustomFieldValueRoutes(app)
}
