export type RequesterReference = {
  readonly requesterId: string
  readonly addressId?: string
  readonly hostEmailHash?: string
  readonly hostClaimHash?: string
  readonly sessionId?: string
  readonly verifiedAt?: string
  readonly verificationSessions?: number
  readonly displayName: string
  readonly verifiedEmail: string
}

export type SubmissionInput = {
  readonly title: string
  readonly description: string
  readonly proposedSolution: string | null
  readonly impactStatement: string | null
  readonly categoryId?: string | null
  readonly boardSlug: string
  readonly emailUpdates: boolean
  readonly idempotencyKey: string
}

export type RequestEditInput = Pick<SubmissionInput, 'title' | 'description' | 'proposedSolution' | 'impactStatement'>

export type PublicMutationResult = {
  readonly slug: string
  readonly moderationState: 'awaiting_review' | 'approved' | 'rejected'
}

export type DuplicateSuggestion = {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly matchedTerms: readonly string[]
}

export type ModerationSubject = 'request' | 'request_edit' | 'comment' | 'comment_edit' | 'attachment'
export type ModerationVerdict = 'approved' | 'rejected'
export type PublicRequestStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'shipped' | 'declined'

export class RequestLifecycleError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 410
  readonly code: string

  constructor(status: 400 | 403 | 404 | 409 | 410, code: string, message: string) {
    super(message)
    this.name = 'RequestLifecycleError'
    this.status = status
    this.code = code
  }
}
