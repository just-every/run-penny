/** Shared policy for request batches and release outbox claims. */
export const retryWindowMs=3600000
export function retryState(priorAttempts:number):'queued'|'failed'{return priorAttempts<5?'queued':'failed'}
export function retryAt(now:number,priorAttempts:number):string{return new Date(now+60000*2**priorAttempts).toISOString()}
export function safeValidationCode(error:unknown):string|null {
 if(!(error instanceof Error)||error.name!=='MailValidationError')return null
 return 'code' in error&&typeof error.code==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(error.code)?error.code:'invalid_mail_input'
}
