interface Read {
  promise: Promise<Response>
  controller: AbortController
  readers: Set<AbortSignal>
}
const pending = new Map<string, Read>()

/** Share concurrent reads only. Settled responses are never retained. */
export function resourceRequest(path: string, signal: AbortSignal): Promise<Response> {
  let read = pending.get(path)
  if (!read) {
    const controller = new AbortController()
    read = { controller, readers: new Set(), promise: fetch(path, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } }) }
    pending.set(path, read)
    const current = read
    void read.promise.finally(() => { if (pending.get(path) === current) pending.delete(path) }).catch(() => {})
  }
  const current = read
  current.readers.add(signal)
  const release = () => {
    current.readers.delete(signal)
    if (!current.readers.size) {
      current.controller.abort()
      if (pending.get(path) === current) pending.delete(path)
    }
  }
  signal.addEventListener('abort', release, { once: true })
  return current.promise.then(response => response.clone()).finally(() => signal.removeEventListener('abort', release))
}
