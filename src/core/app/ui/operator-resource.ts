import { useMatches } from '@tanstack/react-router'
import type { Resources } from '@/core/app/resources.server'
import { useCallback, useEffect, useState } from 'react'

export type OperatorResourceState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'session_expired' }
  | { readonly kind: 'error'; readonly status?: number; readonly message?: string }

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

export function useOperatorResource<T>(path: string): readonly [OperatorResourceState<T>, () => void, { readonly pending: boolean; readonly attempt: number }] {
  const matches = useMatches()
  const prefetched = matches.map((match) => (match.loaderData as Resources | undefined)?.[path]).find((resource) => resource !== undefined)
  const [attempt, setAttempt] = useState(0)
  const key = `${path}\u0000${attempt}`
  const [resource, setResource] = useState<KeyedOperatorResourceState<T>>({ key, state: { kind: 'loading' } })
  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    if (attempt === 0 && prefetched) return
    const controller = new AbortController()
    void fetch(path, { signal: controller.signal, headers: { Accept: 'application/json' } })
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

  const request = { pending: !(attempt === 0 && prefetched) && (resource.key !== key || resource.state.kind === 'loading'), attempt }
  if (attempt === 0 && prefetched) return [prefetched.status === 200 ? { kind: 'ready', data: prefetched.data as T } : prefetched.status === 404 ? { kind: 'not_found' } : prefetched.status === 401 ? { kind: 'session_expired' } : { kind: 'error', status: prefetched.status, message: hintOf(prefetched.data) }, retry, request]
  // Keep forms mounted during refresh; auxiliary resources without a loader
  // snapshot fetch on first mount and still require server-side admission.
  if(resource.key!==key && resource.key.split('\u0000')[0]===path && resource.state.kind==='ready')return [resource.state,retry,request]
  if(resource.key!==key && prefetched?.status===200)return [{kind:'ready',data:prefetched.data as T},retry,request]
  return [resource.key === key ? resource.state : { kind: 'loading' }, retry, request]
}

/** A refusal may name its cause and next step (for example an active data operation). */
function hintOf(body: unknown): string | undefined {
  return typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : undefined
}
async function failureHint(response: Response): Promise<string | undefined> {
  try { return hintOf(await response.json()) } catch { return undefined }
}
