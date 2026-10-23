import { basename, dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { readSettings, freePort } from '@runeditrun/rer/local-installer'
import { privateDirectory } from '@runeditrun/rer/private-files'
import { buildEnvironment } from '@runeditrun/rer/local/environment'
import { installationFailure } from '@runeditrun/rer/failures'
import { recoverInterrupted } from '@runeditrun/rer/local/recovery'

export const bindings = /^(SESSION_SECRET|INSTALLATION_KEY(?:_|$)|SETUP_TOKEN|OWNER_EMAIL|OPERATOR_EMAIL|APP_ORIGIN|PENNY_ENVIRONMENT|WORKSPACE_TIMEZONE|AUTH_|MAIL_|OIDC_|SENDGRID_|RESEND_|CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN|CF_THROWAWAY_|RER_DEPLOY_)/
export const settings = root => readSettings(root, { file: '.dev.vars' })
export async function recoveredSettings(root) {
  const operation = await recoverInterrupted(root)
  try { return await settings(root) }
  finally { await operation?.release() }
}
export function commandEnvironment() {
  const env = buildEnvironment(bindings)
  for (const key of Object.keys(env)) if (/(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|AUTHORIZATION|COOKIE|CREDENTIAL)/i.test(key) || ['NODE_OPTIONS', 'NODE_PATH'].includes(key)) delete env[key]
  return env
}
export function localState(root, env = process.env) {
  root = resolve(root)
  const state = join(root, '.wrangler/state')
  const sibling = join(dirname(root), `.penny-local-state-${basename(root)}`)
  if (existsSync(sibling) || (env.PENNY_LOCAL_STATE && resolve(env.PENNY_LOCAL_STATE) !== state)) {
    throw new Error('Ambiguous Penny state: local data lives only in .wrangler/state, and another store is present. Penny never reads, moves or deletes it; see "Local state placement" in OPERATIONS.md before setup, dev, reset or transfer.')
  }
  return state
}
export async function prepareLocal(context) {
  if (process.versions.node !== '22.20.0') throw installationFailure('node_version', { version: '22.20.0' })
  const saved = await settings(context.root)
  const email = context.input.OPERATOR_EMAIL?.trim().toLowerCase()
  if (context.input.OPERATOR_EMAIL !== context.input.OPERATOR_EMAIL?.trim() || !/^[a-zA-Z0-9.!+_%-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email ?? '')) throw context.fail('setup')
  if (saved.values.OPERATOR_EMAIL && saved.values.OPERATOR_EMAIL !== email) {
    context.store.report('The saved owner differs from this choice. Resume with the saved owner; changing setup cannot transfer ownership.')
    throw context.fail('setup')
  }
  if (saved.text !== undefined && saved.values.PENNY_ENVIRONMENT !== 'local') throw context.fail('setup')
  context.hostingInput={...context.input}
  context.store.addSecrets(Object.entries(context.input).filter(([name])=>/SECRET|TOKEN|API_KEY/.test(name)).map(([,value])=>value))
  // Local settings always use the explicit silent development mail transport. Hosted choices
  // stay in the captured approved input for the optional owner-account hook.
  context.input={...context.input,OPERATOR_EMAIL:email,APP_ORIGIN:undefined,MAIL_PROVIDER:undefined,MAIL_FROM:undefined,MAIL_API_KEY:undefined,MAIL_RELAY_URL:undefined,SENDGRID_EVENT_PUBLIC_KEY:undefined,RESEND_WEBHOOK_SECRET:undefined}
  context.stateDirectory = localState(context.root)
  await privateDirectory(context.root, ['.wrangler', 'state'])

}
export async function savedOrigin(context) {
  const saved = (await settings(context.root)).values.APP_ORIGIN
  if (saved) {
    const url = localOrigin({ APP_ORIGIN: saved, PENNY_ENVIRONMENT: 'local' })
    if (context.input.localOrigin && context.input.localOrigin !== url.origin) throw context.fail('setup')
    return saved
  }
  return context.input.localOrigin ? localOrigin({ APP_ORIGIN: context.input.localOrigin, PENNY_ENVIRONMENT: 'local' }).origin : `http://127.0.0.1:${await freePort()}`
}
export function localOrigin(vars) {
  let url
  try { url = new URL(vars.APP_ORIGIN) } catch { throw installationFailure('command_failed', { step: 'start' }) }
  if (vars.PENNY_ENVIRONMENT !== 'local' || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== vars.APP_ORIGIN || url.username || url.password) throw installationFailure('command_failed', { step: 'start' })
  return url
}
export function runtimeEnvironment(root, state = localState(root)) {
  return { ...commandEnvironment(), PENNY_LOCAL_STATE: state, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'true' }
}
