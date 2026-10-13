import { getRuntimeConfiguration } from './extension-config.server'
import { createBlobStore, type BlobStore } from '@/core/platform/blobs'
import { createDatabaseConnection, type DatabaseConnection } from '@/core/platform/database'
import { createJobDispatcher, type JobDispatcher } from '@/core/platform/jobs'
import { loadRuntimeConfiguration, type RuntimeConfiguration, type RuntimeConfigurationSource } from '@/core/platform/configuration'
import type { AppBindings } from '@/core/shared/bindings'

export interface PennyRuntime {
  readonly database: DatabaseConnection
  readonly blobs: BlobStore
  readonly jobs: JobDispatcher
  readonly configuration: RuntimeConfiguration
  readonly bindings: AppBindings
}

export function createPennyRuntime(env: AppBindings, source?: RuntimeConfigurationSource): PennyRuntime {
  const configuration = source ? loadRuntimeConfiguration(source, env) : getRuntimeConfiguration(env)

  if (!env.DB) {
    throw new Error('Missing required DB D1 binding.')
  }

  return {
    database: createDatabaseConnection(env.DB),
    blobs: createBlobStore(env.FILES),
    jobs: createJobDispatcher(env.JOBS),
    configuration,
    bindings: env,
  }
}
