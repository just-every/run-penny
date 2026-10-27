const messages: Record<string, string> = {
  requester_blocked: 'Your feedback access is blocked. Contact the workspace owner for help.',
  requester_identity_required: 'Verify your email again before taking part.',
  requester_verification_required: 'Verify your email before taking part.',
  rate_limited: 'Too many attempts. Wait a moment, then try again.',
  not_found: 'This record is no longer available. Refresh the page to continue.',
  idempotency_conflict: 'This action has changed since it was saved. Refresh the page and try again.',
  attachment_original_missing: 'Choose the original file, then try recovery again.',
  attachment_original_mismatch: 'This file does not match the original upload. Choose the original file and try again.',
}

/** API codes describe the wire protocol; only sentences belong in the interface. */
export function actionMessage(body: unknown, status: number): string {
  if (status === 401) return 'Your session has ended. Sign in again to continue.'
  const result = typeof body === 'object' && body !== null ? body as { error?: unknown; message?: unknown } : {}
  if (typeof result.error === 'string' && Object.hasOwn(messages, result.error)) return messages[result.error]
  // Product routes also supply specific recovery hints. Keep those sentences,
  // while refusing machine identifiers accidentally placed in the message field.
  if (typeof result.message === 'string' && /^[A-Z][\s\S]*[.!?]$/.test(result.message)
    && !/\b(?:[A-Za-z0-9]+_[A-Za-z0-9_]+|[A-Z][A-Z0-9]+_[A-Z0-9_]+)\b/.test(result.message)) return result.message
  if (status === 403) return 'You do not have permission to do this. Contact the workspace owner for help.'
  if (status === 404 || status === 410) return 'This record is no longer available. Refresh the page to continue.'
  if (status === 409) return 'This record changed before the action finished. Refresh the page and try again.'
  if (status === 429) return 'Too many attempts. Wait a moment, then try again.'
  if (status === 400 || status === 422) return 'Penny could not accept these details. Check the form and try again.'
  return 'Penny could not complete this action. Try again; if it keeps failing, contact the workspace owner.'
}
