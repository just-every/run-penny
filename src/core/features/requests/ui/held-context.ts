export interface ModeratedItem { id: string; body?: string; title?: string; description?: string; moderation_state?: string; public_state?: string; original_filename?: string }
export interface Appeal { id: string; body: string; state: string; resolution_reason?: string; resolution?: string }
export interface HeldContext { comments: ModeratedItem[]; edits: ModeratedItem[]; commentEdits: ModeratedItem[]; attachments: ModeratedItem[]; appeals: Appeal[] }

export function heldItems(context: HeldContext) {
  return [
    ...context.comments.filter((i) => i.moderation_state === 'awaiting_review').map((i) => ({ item: i, path: `/api/operator/comments/${i.id}/moderate`, label: 'Comment' })),
    ...context.edits.filter((i) => i.moderation_state === 'awaiting_review').map((i) => ({ item: i, path: `/api/operator/requests/edits/${i.id}/moderate`, label: 'Request edit' })),
    ...context.commentEdits.filter((i) => i.moderation_state === 'awaiting_review').map((i) => ({ item: i, path: `/api/operator/comments/edits/${i.id}/moderate`, label: 'Comment edit' })),
    ...context.attachments.filter((i) => i.public_state !== 'published').map((i) => ({ item: i, path: `/api/operator/attachments/${i.id}/moderate`, label: 'Attachment' })),
  ]
}

