// The request a visitor was reading when they went to verify their email, so the
// verification page can send them back to vote, follow or comment there.
const key = 'penny_requester_return'
const requestPath = /^\/portal\/feedback\/[a-z0-9-]+$/
export function rememberReturn(path: string): void {
  try { if (requestPath.test(path)) localStorage.setItem(key, path) } catch { /* storage unavailable: the page still works */ }
}
export function takeReturn(): string | null {
  try { const path = localStorage.getItem(key); localStorage.removeItem(key); return path && requestPath.test(path) ? path : null } catch { return null }
}
