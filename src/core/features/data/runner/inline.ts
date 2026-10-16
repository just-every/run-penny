import type { Context } from 'hono'

/** Keeps the request's own work running if the person closes the tab; the
 * runner takes over anything left once a stopped step's lease passes. */
export function keepAlive(c: Context, work: Promise<unknown>): void {
 let context: ExecutionContext | undefined
 // Hono throws when no Worker execution context was passed (direct app.fetch).
 try { context = c.executionCtx as ExecutionContext } catch { context = undefined }
 context?.waitUntil(work.catch(() => undefined))
}

/** A confirmed action from checking it to its first steps. Closing the tab
 * cancels the request, so the whole action is kept alive, not just the steps:
 * planning a large erasure or checking a backup can take seconds. */
export function confirmed<T>(c: Context, action: () => Promise<T>): Promise<T> {
 const work = action()
 keepAlive(c, work)
 return work
}
