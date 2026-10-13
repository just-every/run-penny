/** Pure local input validation. No imports from the product, network calls or provider writes. */
export function validateConfiguration(env) {
 if (!['sendgrid', 'resend'].includes(env.MAIL_PROVIDER)) throw new Error('MAIL_PROVIDER-required')
 const key = env.MAIL_PROVIDER === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
 if (!env[key]?.trim()) throw new Error(`missing-${key}`)
 if ((env.MAIL_PROVIDER !== 'sendgrid' && env.SENDGRID_API_KEY) || (env.MAIL_PROVIDER !== 'resend' && env.RESEND_API_KEY)) throw new Error('conflicting-mail-provider')
 if (!env.MAIL_FROM?.trim() || /[\r\n]/.test(env.MAIL_FROM)) throw new Error('MAIL_FROM-required')
 if (typeof env.AUTH_SECRET !== 'string' || env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET-required')
 if (!env.OPERATOR_EMAIL?.includes('@')) throw new Error('OPERATOR_EMAIL-required')
 if (!['production','preview'].includes(env.PENNY_ENVIRONMENT)) throw new Error('PENNY_ENVIRONMENT-required')
 let origin
 try { origin = new URL(env.APP_ORIGIN) } catch { throw new Error('APP_ORIGIN-required') }
 if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || origin.username || origin.password) throw new Error('invalid-APP_ORIGIN')
 if (env.WORKSPACE_TIMEZONE !== undefined) { if (typeof env.WORKSPACE_TIMEZONE !== 'string' || !env.WORKSPACE_TIMEZONE.trim() || /^[+-]/.test(env.WORKSPACE_TIMEZONE.trim())) throw new Error('invalid-WORKSPACE_TIMEZONE'); try { new Intl.DateTimeFormat('en', { timeZone: env.WORKSPACE_TIMEZONE }).format() } catch { throw new Error('invalid-WORKSPACE_TIMEZONE') } }
 if (env.SETUP_TOKEN !== undefined && env.SETUP_TOKEN.length < 32) throw new Error('invalid-SETUP_TOKEN')
}
