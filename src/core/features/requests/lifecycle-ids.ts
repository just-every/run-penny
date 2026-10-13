export { createUlid as createRequestId } from '@/core/shared/ulid'

export async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createRequestSlug(_title: string, id: string): string { return `feedback-${id.toLowerCase()}` }
export function publicRequestUrl(origin: string | undefined, slug: string): string { return `${origin ?? ''}/portal/feedback/${slug}` }
