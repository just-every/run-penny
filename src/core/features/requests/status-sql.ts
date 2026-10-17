/** One effective projection for reads and transactional participation checks. */
export const requestStatusExpression = '(SELECT status FROM penny_request_status WHERE request_id=r.id)'
export const requestStatusChangedAtExpression = '(SELECT changed_at FROM penny_request_status WHERE request_id=r.id)'
export const requestStatusSourceExpression = '(SELECT source FROM penny_request_status WHERE request_id=r.id)'
export const requestStatusLabelExpression = '(SELECT public_label FROM penny_request_status WHERE request_id=r.id)'
export const publicStatuses = ['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'] as const
export const statusLabel = (status: string) => status.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
