import { useMatches } from '@tanstack/react-router'
import type { Resources } from '@/core/app/resources.server'
import { useCallback, useEffect, useState } from 'react'

export type PublicResourceState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'error'; readonly status?: number }

interface KeyedPublicResourceState<T> {
  readonly key: string
  readonly state: PublicResourceState<T>
}

class PublicResourceError extends Error {
  readonly status?: number

  constructor(status?: number) {
    super('The public resource could not be loaded.')
    this.status = status
  }
}

export function usePublicResource<T>(path: string): readonly [PublicResourceState<T>, () => void] {
  const matches = useMatches()
  const prefetched = matches.map((match) => (match.loaderData as Resources | undefined)?.[path]).find((resource) => resource !== undefined)
  const [attempt, setAttempt] = useState(0)
  const key = `${path}\u0000${attempt}`
  const [resource, setResource] = useState<KeyedPublicResourceState<T>>({ key, state: { kind: 'loading' } })

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  useEffect(() => {
    if (attempt === 0 && prefetched) return
    const controller = new AbortController()
    void fetch(path, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new PublicResourceError(response.status)
        return await response.json() as T
      })
      .then((data) => {
        if (!controller.signal.aborted) setResource({ key, state: { kind: 'ready', data } })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResource({ key, state: { kind: 'error', status: error instanceof PublicResourceError ? error.status : undefined } })
      })

    return () => controller.abort()
  }, [key, path, attempt, prefetched])

  if (attempt === 0 && prefetched) return [prefetched.status === 200 ? { kind: 'ready', data: prefetched.data as T } : { kind: 'error', status: prefetched.status }, retry]
  // Keep the visible snapshot while an explicit refresh is in flight, so its
  // controls retain focus and action confirmations. A failed response is still shown.
  if(resource.key!==key && resource.key.split('\u0000')[0]===path && resource.state.kind==='ready')return [resource.state,retry]
  if(resource.key!==key && prefetched?.status===200)return [{kind:'ready',data:prefetched.data as T},retry]
  return [resource.key === key ? resource.state : { kind: 'loading' }, retry]
}
