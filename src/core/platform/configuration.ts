import { z } from 'zod'
import type { AppBindings } from '@/core/shared/bindings'

const runtimeConfigurationSchema = z.object({
  operatorAllowlist: z.array(z.string().trim().toLowerCase().email()).min(1),
  workspaceTimezone: z.string().trim().min(1),
  publicOriginAllowlist: z.array(z.string().trim().min(1)).min(1),
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
  readonly appOrigin?: string
  readonly portalIdentitySecret?: string
  readonly authSecret?: string
  readonly setupToken?: string
  readonly ownerEmail?: string
  readonly mailFrom?: string
  readonly mailProvider?: string
  readonly mailApiKey?: string
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
  const publicOriginAllowlist = new Set(parsed.data.publicOriginAllowlist.map(parseOrigin))
  const environment = env.PENNY_ENVIRONMENT ?? 'local'

  if (environment !== 'local' && environment !== 'test' && environment !== 'preview' && environment !== 'production') {
    throw new ConfigurationError(`PENNY_ENVIRONMENT must be local, test, preview, or production; received ${environment}.`)
  }

  if (environment === 'preview' || environment === 'production') {
    const required = ['APP_ORIGIN','AUTH_SECRET','OPERATOR_EMAIL'] as const
    const missing = required.filter(name => !env[name]?.trim())
    if (missing.length) throw new ConfigurationError(`Missing required environment values: ${missing.join(', ')}.`)
    if (env.AUTH_SECRET!.length < 32) throw new ConfigurationError('AUTH_SECRET must contain at least 32 characters.')
    if ((env.MAIL_PROVIDER&&env.MAIL_PROVIDER!=='later') || env.MAIL_FROM) {
    if (!env.MAIL_FROM?.trim()) throw new ConfigurationError('Missing required environment value: MAIL_FROM.')
    if (env.MAIL_PROVIDER !== 'sendgrid' && env.MAIL_PROVIDER !== 'resend') throw new ConfigurationError('MAIL_PROVIDER must be sendgrid or resend.')
    const providerKey = env.MAIL_PROVIDER === 'sendgrid' ? 'SENDGRID_API_KEY' : 'RESEND_API_KEY'
    if (!env[providerKey]?.trim()) throw new ConfigurationError(`Missing required environment value: ${providerKey}.`)
    }
    if (new URL(env.APP_ORIGIN!).protocol !== 'https:') throw new ConfigurationError('APP_ORIGIN must use HTTPS.')
  }
  const appOrigin = env.APP_ORIGIN ? parseOrigin(env.APP_ORIGIN) : undefined

  return {
    operatorAllowlist: new Set([...parsed.data.operatorAllowlist,...(env.OPERATOR_EMAIL ? [z.email().parse(env.OPERATOR_EMAIL.trim().toLowerCase())] : [])]),
    workspaceTimezone,
    publicOriginAllowlist,
    environment,
    appOrigin,
    portalIdentitySecret: env.PORTAL_IDENTITY_SECRET,
    authSecret: env.AUTH_SECRET, setupToken: env.SETUP_TOKEN,
    ownerEmail: env.OPERATOR_EMAIL ?? parsed.data.operatorAllowlist[0],
    mailFrom: env.MAIL_FROM, mailProvider: env.MAIL_PROVIDER==='later'?undefined:env.MAIL_PROVIDER, mailApiKey: env.MAIL_PROVIDER === 'resend' ? env.RESEND_API_KEY : env.MAIL_PROVIDER === 'sendgrid' ? env.SENDGRID_API_KEY : undefined,
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
