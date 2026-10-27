import { relative } from 'node:path'

const inputs = {
  CLOUDFLARE_ACCOUNT_ID: 'the Cloudflare account that will own Penny’s Worker, database, files and queue',
  CLOUDFLARE_API_TOKEN: 'an account-scoped API token with Workers Scripts, D1, R2 Storage and Queues edit permissions',
  OPERATOR_EMAIL: 'the first owner’s email address, used to claim Penny and sign in',
  MAIL_PROVIDER: 'the sign-in email provider: sendgrid or resend',
  MAIL_FROM: 'a sender address on the email provider’s verified domain',
  MAIL_API_KEY: 'the selected email provider’s API key, used to send sign-in links',
  MAIL_RELAY_URL: 'the assigned HTTPS address of the managed mail relay',
}

export function deploymentCheckCommand(options = {}) {
  const quote = value => `'${String(value).replaceAll("'", "'\"'\"'")}'`
  const cwd = options.cwd ? relative(process.cwd(), options.cwd) : ''
  return `npx -y @runeditrun/rer deploy --dry-run${options.environment ? ` --environment ${quote(options.environment)}` : ''}${options.envFile ? ` --env-file ${quote(options.envFile)}` : ''}${cwd ? ` --cwd ${quote(cwd)}` : ''}`
}

export function missingOwnerInputs(names, command = deploymentCheckCommand()) {
  return ['Hosting is not configured. Nothing was uploaded.', ...names.map(name => `  - ${name} — ${inputs[name] ?? 'an installation input described in OPERATIONS.md'}.`),
    `Set these inputs in your environment or an owned, private file passed with --env-file, then run ${command}.`].join('\n')
}

const causes = {
  'invalid-owner-input': 'The Cloudflare account, API token or owner email is invalid.',
  'unsupported-mail-provider': 'Choose SendGrid or Resend for sign-in email.',
  'incomplete-mail-provider': 'The selected email provider needs a verified sender and its API key.',
  'renamed-mail-credential': 'Supply the selected email provider’s key as MAIL_API_KEY.',
  'conflicting-mail-provider': 'The email inputs belong to different providers. Keep only the selected provider’s inputs.',
  'invalid-workspace-timezone': 'The workspace timezone is not a valid IANA timezone.',
  'saved-owner-identity-conflict': 'This deployment already belongs to a different owner. Keep its saved owner settings.',
  'saved-owner-configuration-conflict': 'These inputs conflict with the saved deployment. Keep its saved settings.',
  'missing-owner-credential-file': 'The private deployment settings are missing. Restore them from your deployment backup.',
  'owner-origin-mismatch': 'The selected Cloudflare account does not match the expected Penny address.',
}

export function ownerFailureMessage(error, command) {
  if (error?.inputs) return missingOwnerInputs(error.inputs, command)
  return `${causes[error?.message] ?? 'Penny could not complete the hosting check. Check the private deployment settings and Cloudflare account permissions.'} Then run ${command}.`
}
