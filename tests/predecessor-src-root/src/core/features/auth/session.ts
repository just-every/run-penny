const textEncoder = new TextEncoder()

export const OPERATOR_SESSION_COOKIE = 'penny_operator_session'

export async function hashOperatorSessionToken(token: string): Promise<string> {
  if (!token) {
    throw new Error('Operator session token cannot be empty.')
  }

  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token))

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function readOperatorSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null
  }

  for (const entry of cookieHeader.split(';')) {
    const [name, ...encodedValue] = entry.trim().split('=')
    if (name !== OPERATOR_SESSION_COOKIE || encodedValue.length === 0) {
      continue
    }

    try {
      return decodeURIComponent(encodedValue.join('='))
    } catch {
      return null
    }
  }

  return null
}
