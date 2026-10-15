import {registerLearningRoutes} from '@/core/features/learning/routes'
import {registerOperatorManagementRoutes} from '@/core/features/auth/operator-management-routes'
import {editorDocumentHeaders} from '@/core/features/editor/headers'
import {registerFrameSettings} from '@/core/features/settings/frame-settings'
import {admitPublicRequest} from './public-rate'
import {validPathParameters} from './path-parameters'
import {failureSummary} from './failure-log'
import {matchedRoutes} from 'hono/route'
import {MutationError} from './operator-mutations'
import {ZodError} from 'zod'
import {registerIntegrationApi} from '@/core/features/integrations/api-routes'
import {registerDeliveryRoutes} from '@/core/features/integrations/delivery-routes'
import {registerTrackerRoutes} from '@/core/features/integrations/tracker-routes'
import {registerBrandingRoutes} from '@/core/features/settings/branding'
import {registerEditorRoutes} from '@/core/features/editor/routes'
import { registerEvidenceRoutes } from '@/core/features/evidence/routes'
import { registerFeedbackImportRoutes } from '@/core/features/imports/routes'
import { registerDecisionRoutes } from '@/core/features/decisions/routes'
import { registerRoadmapRoutes } from '@/core/features/roadmap/routes'
import { registerReleaseMutationRoutes } from '@/core/features/releases/routes'
import { unsubscribeEndpoint, preferenceFailure, preferenceForbidden } from '@/core/features/notifications/unsubscribe-page'
import { registerNotificationRoutes } from '@/core/features/notifications/routes'
import { RequestLifecycleError } from '@/core/features/requests/lifecycle-types'
import { RequesterIdentityError } from '@/core/features/auth/requester'
import { registerPublicRequestMutationRoutes } from '@/core/features/requests/public-routes'
import { registerRequestOperatorRoutes } from '@/core/features/requests/operator-routes'
import { registerCustomFieldRoutes } from '@/core/features/settings/custom-fields'
import { registerCatalogMutationRoutes } from '@/core/features/catalog/routes'
import { Hono } from 'hono'
import { AuthError } from '../../../base/modules/operator-auth/index.mjs'
import { registerDataRoutes } from '@/core/features/data/routes'
import { registerNativeRequestRoutes } from '@/core/features/requests/native-routes'
import { registerNativeAuthRoutes } from '@/core/features/auth/native-routes'
import { registerLocalOutbox } from '@/core/features/auth/local-outbox'
import { registerOwnerClaimRoutes } from '@/core/features/auth/owner-claim'
import { registerOperatorAuthRoutes } from '@/core/features/auth/operator'
import { registerDependencyRoutes } from '@/core/features/auth/dependencies'
import { NativeError } from '@/core/features/auth/native-tokens'
import { registerAuthRoutes } from '@/core/features/auth/routes'
import { registerHealthRoutes } from '@/core/features/health/routes'
import { registerPortalRoutes } from '@/core/features/portal/routes'
import { registerWorkspaceReadRoutes } from '@/core/features/workspace/routes'
import { createPennyRuntime, type PennyRuntime } from './runtime'
import type { RuntimeConfigurationSource } from '@/core/platform/configuration'
import type { AppBindings } from '@/core/shared/bindings'

type PennyWorkerEnvironment = {
  Bindings: AppBindings
  Variables: {
    runtime: PennyRuntime
    renderDocument?: (request: Request) => Promise<Response>
  }
}


export interface PennyAppOptions {
  runtimeConfiguration?: RuntimeConfigurationSource
}

export function createPennyApi(options: PennyAppOptions = {}) {
  const app = new Hono<PennyWorkerEnvironment>()

  app.use('*', async (context, next) => {
    const refusal=await admitPublicRequest(context.req.raw,context.env)
    if(refusal)return refusal
    context.set('runtime', createPennyRuntime(context.env, options.runtimeConfiguration))
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
      const origin = context.req.header('Origin')
      const fetchSite = context.req.header('Sec-Fetch-Site')
      const unsubscribePost = context.req.method === 'POST' && context.req.path === unsubscribeEndpoint
      // The no-referrer preference page produces an opaque Origin on native form
      // navigation. Only this route can admit it; its signed recipient/scope
      // capability must still validate before any preference mutation.
      const nativeUnsubscribeForm = unsubscribePost && origin === 'null' && fetchSite === 'same-origin'
      if ((origin && origin !== new URL(context.req.url).origin && !nativeUnsubscribeForm) || fetchSite === 'cross-site') {
        return unsubscribePost ? preferenceForbidden() : context.json({ error: 'forbidden_origin' }, 403)
      }
    }
    if (!validPathParameters(context)) return context.json({ error: 'validation_failed' }, 400)
    if (context.req.path.startsWith('/api/auth/') || context.req.path.startsWith('/api/public/identity/')) context.header('Cache-Control', 'no-store')
    await next()
    context.res = await editorDocumentHeaders(context.res, context.get('runtime'), context.req.path)
  })

  registerLearningRoutes(app)
  registerIntegrationApi(app)
  registerBrandingRoutes(app)
  registerFrameSettings(app)
  registerDeliveryRoutes(app)
  registerTrackerRoutes(app)
  registerEditorRoutes(app)
  registerLocalOutbox(app)
  registerEvidenceRoutes(app)
  registerFeedbackImportRoutes(app)
  registerDecisionRoutes(app)
  registerRoadmapRoutes(app)
  registerHealthRoutes(app)
  registerAuthRoutes(app)
  registerOwnerClaimRoutes(app)
  registerDependencyRoutes(app)
  registerOperatorAuthRoutes(app)
  registerOperatorManagementRoutes(app)
  registerNativeAuthRoutes(app)
  registerReleaseMutationRoutes(app)
  registerNotificationRoutes(app)
  registerPublicRequestMutationRoutes(app)
  registerRequestOperatorRoutes(app)
  registerCustomFieldRoutes(app)
  registerCatalogMutationRoutes(app)
  registerPortalRoutes(app)
  registerWorkspaceReadRoutes(app)
  registerNativeRequestRoutes(app)
  registerDataRoutes(app)

  app.onError((error, context) => {
    // Native host and origin denials can reach this boundary before a route's guards.
    if (error instanceof AuthError && error.status === 403) return context.json({ error: 'forbidden' }, 403)
    if(context.req.path.startsWith('/api/operator/learning')&&error instanceof ZodError)return context.json({error:'learning_validation_failed'},400)
    if(context.req.path.startsWith('/api/v1/')||context.req.path.startsWith('/api/operator/integrations/')||context.req.path==='/api/operator/settings/branding'){
      if(error instanceof MutationError)return context.json({error:'integration_mutation_refused',message:error.message},error.status)
      if(error instanceof ZodError)return context.json({error:'validation_failed'},400)
    }
    if(context.req.path.startsWith('/api/operator/feedback-import/')&&!(error instanceof NativeError))return context.json({error:'feedback_import_refused',reason:/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'SOURCE_OR_STORAGE_FAILURE'},409)
    if(context.req.path===unsubscribeEndpoint)return preferenceFailure(error)
    if (error instanceof NativeError && error.hint) return context.json({ error: error.code, message: error.hint }, error.status)
    if (error instanceof NativeError || error instanceof RequesterIdentityError || error instanceof RequestLifecycleError) return context.json({ error: error.code }, error.status)
    if(context.req.path.startsWith('/api/integrations/')||context.req.path.startsWith('/api/operator/integrations/'))return context.json({error:'integration_operation_failed'},503)
    console.error('Penny request failed', JSON.stringify({ method: context.req.method, route: matchedRoutes(context).findLast(route => route.method !== 'ALL' && !route.path.endsWith('*'))?.path ?? 'unmatched', ...failureSummary(error) }))

    return context.json(
      {
        error: 'service_unavailable',
        message: 'Penny could not complete the requested operation.',
      },
      503,
    )
  })

  return app
}
