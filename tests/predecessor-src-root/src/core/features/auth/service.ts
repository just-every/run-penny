import type { PennyRuntime } from '@/core/app/runtime'
import { AuthRepository } from './repository'
import { hashOperatorSessionToken } from './session'

export interface AuthenticatedOperator {
  readonly id: string
  readonly email: string
  readonly displayName: string
}

export async function authenticateOperator(runtime: PennyRuntime, token: string | null): Promise<AuthenticatedOperator | null> {
  if (!token) {
    return null
  }

  const now = new Date().toISOString()
  const repository = new AuthRepository(runtime.database)
  const session = await repository.findActiveOperatorSession(await hashOperatorSessionToken(token), now)

  if (!session || !runtime.configuration.operatorAllowlist.has(session.email.toLowerCase())) {
    return null
  }

  await repository.recordSessionUse(session.sessionId, now)

  return {
    id: session.operatorId,
    email: session.email,
    displayName: session.displayName,
  }
}
