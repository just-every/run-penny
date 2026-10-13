export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export function opaqueToken(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
export class NativeError extends Error {
  readonly code: string
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503
  constructor(code: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503) { super(code); this.code=code; this.status=status }
}
export async function takeRateLimit(db: D1Database, scope: string, subject: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date().toISOString()
  const result = await db.prepare(`INSERT INTO native_rate_limits(scope,subject_hash,count,expires_at) VALUES(?,?,1,?)
    ON CONFLICT(scope,subject_hash) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
    .bind(scope, await digest(subject), new Date(Date.now()+windowMs).toISOString(), now, now).first<{count:number}>()
  if (!result || result.count>limit) throw new NativeError('rate_limited',429)
}
