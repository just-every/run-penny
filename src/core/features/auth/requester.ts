import type { PennyRuntime } from '@/core/app/runtime'
import { authenticateNativeRequester } from './native-service'
import { NativeError } from './native-tokens'
import { verifyHostRequester, type VerifiedRequester, type ExistingHostIdentity } from './host-identity'
import {verifyHostClaims} from './host-claims'

export interface RequesterIdentity {
  readonly requesterId: string
  readonly addressId?: string
  readonly sessionId?: string
  readonly verifiedAt?: string
  readonly verificationSessions?: number
  readonly displayName: string
  readonly verifiedEmail: string
  readonly hostEmailHash?: string
  readonly hostClaimHash?: string
  readonly source: 'email' | 'host'
}

export class RequesterIdentityError extends Error {
  readonly code: 'requester_identity_required' | 'requester_blocked' | 'auth_unavailable'
  readonly status: 401 | 403 | 503

  constructor(
    code: 'requester_identity_required' | 'requester_blocked' | 'auth_unavailable',
    status: 401 | 403 | 503,
  ) {
    super(code)
    this.name = 'RequesterIdentityError'
    this.code = code
    this.status = status
  }
}

/**
 * Resolves the only identities public mutations may trust. Body fields are
 * deliberately absent: a requester's identity always derives from either the
 * browser-local bearer session or an HMAC-authenticated host assertion.
 */
export async function requireRequesterIdentity(
  runtime: PennyRuntime,
  request: Pick<Request, 'headers'>,
  existingHost?: ExistingHostIdentity,
): Promise<RequesterIdentity> {
  const suppliedAuthorization = request.headers.has('Authorization')
  const bearer = requesterBearerToken(request.headers.get('Authorization'))
  if (suppliedAuthorization && !bearer) throw new RequesterIdentityError('requester_identity_required',401)
  if (bearer) {
    try {
      const native = await authenticateNativeRequester(runtime, bearer)
      const requester = { requesterId: native.id, displayName: native.displayName, verifiedEmail: native.email, addressId:native.addressId,sessionId:native.sessionId }
      if (!requester) throw new RequesterIdentityError('requester_identity_required', 401)
      return fromVerifiedRequester(requester, 'email')
    } catch (error) {
      throw requesterError(error)
    }
  }

  const encodedClaims = request.headers.get('X-Penny-Identity')
  const encodedSignature = request.headers.get('X-Penny-Identity-Signature')
  if (!encodedClaims && !encodedSignature) throw new RequesterIdentityError('requester_identity_required', 401)
  if (!encodedClaims || !encodedSignature) throw new RequesterIdentityError('requester_identity_required', 401)

  try {
    const claims = await verifyHostClaims(runtime, encodedClaims, encodedSignature)
    const requester = await verifyHostRequester(runtime, claims, existingHost)
    return fromVerifiedRequester(requester, 'host')
  } catch (error) {
    throw requesterError(error)
  }
}

export function hasRequesterIdentity(request: Pick<Request,'headers'>): boolean {
  return ['Authorization','X-Penny-Identity','X-Penny-Identity-Signature'].some(name=>request.headers.has(name))
}

/** Read-only admission for an existing verified address, never provisioning. */
export async function existingVerifiedHostIdentity(runtime: PennyRuntime, request: Request): Promise<ExistingHostIdentity | null> {
  if (request.headers.has('Authorization')) return null
  const claims = request.headers.get('X-Penny-Identity'), signature = request.headers.get('X-Penny-Identity-Signature')
  if (!claims || !signature) return null
  try {
    const verified = await verifyHostClaims(runtime, claims, signature)
    return await runtime.database.binding.prepare(`SELECT r.id AS requesterId,r.display_name AS displayName,a.id AS addressId,a.email AS verifiedEmail,a.verified_at AS verifiedAt,
      (SELECT count(*) FROM native_requester_sessions WHERE address_id=a.id) AS verificationSessions
      FROM requester_addresses a JOIN requesters r ON r.id=a.requester_id
      WHERE a.email=? AND a.verified_at IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM requester_identity_merges WHERE source_requester_id=r.id)`).bind(verified.email).first<ExistingHostIdentity>()
  }
  catch (error) { if (error instanceof RequesterIdentityError || (error instanceof NativeError && error.status===401)) return null; throw error }
}

function requesterBearerToken(value: string | null): string | null {
  if (!value) return null
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(value)
  return match?.[1] ?? null
}

function fromVerifiedRequester(requester: VerifiedRequester, source: 'email' | 'host'): RequesterIdentity {
  return { ...requester, source }
}

function requesterError(error: unknown): RequesterIdentityError {
  if (error instanceof RequesterIdentityError) return error
  if (error instanceof NativeError) {
    if (error.code === 'requester_blocked') return new RequesterIdentityError('requester_blocked', 403)
    if (error.code === 'auth_unavailable') return new RequesterIdentityError('auth_unavailable', 503)
  }
  if(error instanceof NativeError && error.status===401)return new RequesterIdentityError('requester_identity_required',401)
  throw error
}
