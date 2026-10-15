import { z } from 'zod'
import type { AppBindings } from '@/core/shared/bindings'

const runtimeConfigurationSchema = z.object({
  operatorAllowlist: z.array(z.string().trim().toLowerCase().email()).min(1),
  workspaceTimezone: z.string().trim().min(1),
  publicOriginAllowlist: z.array(z.string().min(1)).max(10),
}).strict()

export interface RuntimeConfigurationSource {
  operatorAllowlist: readonly string[]
  workspaceTimezone: string
  publicOriginAllowlist: readonly string[]
}

export interface RuntimeConfiguration {
  readonly operatorAllowlist: ReadonlySet<string>
  readonly workspaceTimezone: string
  readonly publicOriginAllowlist: ReadonlySet<string>
  readonly environment: 'local' | 'test' | 'preview' | 'production'
  /** RER_DEMO=1 (`rer demo` or a hosted demo; `rer deploy` refuses it): mail is silently suppressed. */
  readonly demo: boolean
  readonly appOrigin?: string
  readonly portalIdentitySecret?: string
  readonly authSecret?: string
  readonly setupToken?: string
  readonly ownerEmail?: string
  readonly mailFrom?: string
  readonly mailProvider?: string
  readonly mailApiKey?: string
  readonly mailRelayUrl?: string
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export function loadRuntimeConfiguration(
  source: RuntimeConfigurationSource,
  env: AppBindings,
): RuntimeConfiguration {
  const parsed = runtimeConfigurationSchema.safeParse(source)

  if (!parsed.success) {
    throw new ConfigurationError(`Invalid Penny configuration: ${z.prettifyError(parsed.error)}`)
  }

  const workspaceTimezone = env.WORKSPACE_TIMEZONE === undefined ? parsed.data.workspaceTimezone : env.WORKSPACE_TIMEZONE.trim()
  validateTimezone(workspaceTimezone)
  const environment = env.PENNY_ENVIRONMENT ?? 'local', demo = env.RER_DEMO === '1'

  if (environment !== 'local' && environment !== 'test' && environment !== 'preview' && environment !== 'production') {
    throw new ConfigurationError(`PENNY_ENVIRONMENT must be local, test, preview, or production; received ${environment}.`)
  }

  const publicOriginAllowlist = new Set(validateFrameOrigins(parsed.data.publicOriginAllowlist, environment))
  if (env.PORTAL_FRAME_ORIGINS) throw new ConfigurationError('PORTAL_FRAME_ORIGINS is retired; move exact origins to publicOriginAllowlist or Portal embedding settings.')

  if (environment === 'preview' || environment === 'production') {
    const required = ['APP_ORIGIN','AUTH_SECRET','OPERATOR_EMAIL'] as const
    const missing = required.filter(name => !env[name]?.trim())
    if (missing.length) throw new ConfigurationError(`Missing required environment values: ${missing.join(', ')}.`)
    if (env.AUTH_SECRET!.length < 32) throw new ConfigurationError('AUTH_SECRET must contain at least 32 characters.')
    if (!(demo && env.MAIL_PROVIDER === 'development') && ((env.MAIL_PROVIDER&&env.MAIL_PROVIDER!=='later') || env.MAIL_FROM)) {
    if (!env.MAIL_FROM?.trim()) throw new ConfigurationError('Missing required environment value: MAIL_FROM.')
    if (env.MAIL_PROVIDER !== 'sendgrid' && env.MAIL_PROVIDER !== 'resend' && env.MAIL_PROVIDER !== 'rer') throw new ConfigurationError('MAIL_PROVIDER must be rer, sendgrid or resend.')
    if (!env.MAIL_API_KEY?.trim()) throw new ConfigurationError('Missing required environment value: MAIL_API_KEY.')
    if (env.MAIL_PROVIDER === 'rer' && !env.MAIL_RELAY_URL?.trim()) throw new ConfigurationError('Missing required environment value: MAIL_RELAY_URL.')
    }
    if (new URL(env.APP_ORIGIN!).protocol !== 'https:') throw new ConfigurationError('APP_ORIGIN must use HTTPS.')
  }
  const appOrigin = env.APP_ORIGIN ? parseOrigin(env.APP_ORIGIN) : undefined

  return {
    operatorAllowlist: new Set([...parsed.data.operatorAllowlist,...(env.OPERATOR_EMAIL ? [z.email().parse(env.OPERATOR_EMAIL.trim().toLowerCase())] : [])]),
    workspaceTimezone,
    publicOriginAllowlist,
    environment,
    demo,
    appOrigin,
    portalIdentitySecret: env.PORTAL_IDENTITY_SECRET,
    authSecret: env.AUTH_SECRET, setupToken: env.SETUP_TOKEN,
    ownerEmail: env.OPERATOR_EMAIL ?? parsed.data.operatorAllowlist[0],
    mailFrom: env.MAIL_FROM, mailProvider: env.MAIL_PROVIDER==='later'?undefined:env.MAIL_PROVIDER, mailRelayUrl: env.MAIL_RELAY_URL, mailApiKey: env.MAIL_PROVIDER === 'later' ? undefined : env.MAIL_API_KEY,
  }
}

function validateTimezone(timezone: string): void {
  try {
    if (/^[+-]/.test(timezone)) throw new Error('Offset is not an IANA name')
    new Intl.DateTimeFormat('en-AU', { timeZone: timezone }).format()
  } catch {
    throw new ConfigurationError(`workspaceTimezone must be an IANA timezone; received ${timezone}.`)
  }
}

function parseOrigin(value: string): string {
  try {
    const parsed = new URL(value)
    if (parsed.origin !== value) {
      throw new Error('not an origin')
    }

    return parsed.origin
  } catch {
    throw new ConfigurationError(`publicOriginAllowlist and APP_ORIGIN values must be origins without a path; received ${value}.`)
  }
}

/** Exact origins only: normalization must not silently broaden an operator's input. */
export function validateFrameOrigins(values: unknown, environment: string): string[] {
  if (!Array.isArray(values) || values.length > 10) throw new ConfigurationError('Use at most ten exact origins.')
  return [...new Set(values.map(value => {
    try {
      if (typeof value !== 'string') throw new Error()
      const url = new URL(value)
      const local = ['local', 'test'].includes(environment) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      if (url.origin !== value || url.username || url.password || url.origin === 'null' || url.hostname.includes('*') || !(url.protocol === 'https:' || (local && url.protocol === 'http:'))) throw new Error()
      return value
    } catch { throw new ConfigurationError('Use exact HTTPS origins without paths, credentials or wildcards. Local loopback HTTP is allowed only in local mode.') }
  }))]
}
