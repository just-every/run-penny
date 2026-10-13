import { parseInput } from '@/core/features/auth/native-routes'
import { NativeError } from '@/core/features/auth/native-tokens'
import type { Context } from 'hono'
import type { z } from 'zod'
import type { PennyRuntime } from './runtime'
import { currentOperator } from '@/core/features/auth/routes'
import type { AppBindings } from '@/core/shared/bindings'
import type { AuthenticatedOperator } from '@/core/features/auth/operator'

export interface OperatorMutationEnvironment {
  Bindings: AppBindings
  Variables: { runtime: PennyRuntime }
}

export class MutationError extends Error {
  readonly status: 400 | 404 | 409 | 422

  constructor(status: 400 | 404 | 409 | 422, message: string) {
    super(message)
    this.status = status
  }
}

export async function requireOperator(context: Context<OperatorMutationEnvironment>): Promise<AuthenticatedOperator | null> {
  const operator = await currentOperator(context)
  return operator
}

export async function parseMutationBody<T>(context: Context<OperatorMutationEnvironment>, schema: z.ZodType<T>): Promise<T | null> {
  try { return await parseInput(context.req.raw,schema) } catch(error) { if(error instanceof NativeError && error.status===400)return null;throw error }
}

export function mutationFailure(context: Context<OperatorMutationEnvironment>, error: unknown): Response {
  if (error instanceof MutationError) {
    return context.json({ error: 'mutation_failed', message: error.message }, error.status)
  }
  throw error
}
