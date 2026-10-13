import type { BlobStore } from '@/core/platform/blobs'
import type { DatabaseConnection } from '@/core/platform/database'
import type { JobDispatcher } from '@/core/platform/jobs'
import { HealthRepository } from './repository'

export interface HealthDependencies {
  database: DatabaseConnection
  blobs: BlobStore
  jobs: JobDispatcher
}

export async function verifyHealth({ database, blobs, jobs }: HealthDependencies): Promise<void> {
  const repository = new HealthRepository(database)
  await Promise.all([
    repository.verifyDatabaseConnection(),
    blobs.verifyReachability(),
    jobs.verifyAvailability(),
  ])
}
