import { useMatches } from '@tanstack/react-router'
import type { Resources } from '@/core/app/resources.server'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { resourceRequest } from './resource-request'

export type OperatorResourceState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'session_expired' }
  | { readonly kind: 'error'; readonly status?: number; readonly message?: string }

const loading = { kind: 'loading' } as const

interface KeyedOperatorResourceState<T> {
  readonly key: string
  readonly state: OperatorResourceState<T>
}

class OperatorResourceError extends Error {
  readonly status: number
  readonly hint?: string

  constructor(status: number, hint?: string) {
    super(`Operator resource request failed with ${status}`)
    this.status = status
    this.hint = hint
  }
}

export function useOperatorResource<T>(path: string | null): readonly [OperatorResourceState<T>, () => void, { readonly pending: boolean; readonly attempt: number }] {
  const matches = useMatches()
  const prefetched = path ? matches.map((match) => (match.loaderData as Resources | undefined)?.[path]).find((resource) => resource !== undefined) : undefined
  const [attempt, setAttempt] = useState(0)
  const key = `${path}\u0000${attempt}`
  const [resource, setResource] = useState<KeyedOperatorResourceState<T>>({ key, state: { kind: 'loading' } })
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    if (!path || (attempt === 0 && prefetched)) return
    const controller = new AbortController()
    void resourceRequest(path, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw new OperatorResourceError(response.status, await failureHint(response))
        return await response.json() as T
      })
      .then((data) => {
        if (!controller.signal.aborted) setResource({ key, state: { kind: 'ready', data } })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof OperatorResourceError && error.status === 401) {
          setResource({ key, state: { kind: 'session_expired' } })
          return
        }
        if (error instanceof OperatorResourceError && error.status === 404) {
          setResource({ key, state: { kind: 'not_found' } })
          return
        }
        setResource({ key, state: error instanceof OperatorResourceError ? { kind: 'error', status: error.status, message: error.hint } : { kind: 'error' } })
      })

    return () => controller.abort()
  }, [key, path, attempt, prefetched])

  // Each render must return the same state object until the data changes:
  // consumers key effects on it, and a fresh object per render loops them.
  const snapshot = useMemo<OperatorResourceState<T> | null>(() => prefetched ? snapshotState<T>(prefetched) : null, [prefetched])
  const request = { pending: Boolean(path) && !(attempt === 0 && prefetched) && (resource.key !== key || resource.state.kind === 'loading'), attempt }
  if (!path) return [loading, retry, request]
  if (attempt === 0 && snapshot) return [snapshot, retry, request]
  // Keep forms mounted during refresh; auxiliary resources without a loader
  // snapshot fetch on first mount and still require server-side admission.
  if(resource.key!==key && resource.key.split('\u0000')[0]===path && resource.state.kind==='ready')return [resource.state,retry,request]
  if(resource.key!==key && snapshot?.kind==='ready')return [snapshot,retry,request]
  return [resource.key === key ? resource.state : loading, retry, request]
}

function snapshotState<T>(prefetched: { status: number; data: unknown }): OperatorResourceState<T> {
  if (prefetched.status === 200) return { kind: 'ready', data: prefetched.data as T }
  if (prefetched.status === 404) return { kind: 'not_found' }
  if (prefetched.status === 401) return { kind: 'session_expired' }
  return { kind: 'error', status: prefetched.status, message: hintOf(prefetched.data) }
}

/** A refusal may name its cause and next step (for example an active data operation). */
function hintOf(body: unknown): string | undefined {
  return typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : undefined
}
async function failureHint(response: Response): Promise<string | undefined> {
  try { return hintOf(await response.json()) } catch { return undefined }
}
