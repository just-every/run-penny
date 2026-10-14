import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { readSettings } from '@runeditrun/rer/local-installer'
import { privateDirectory, writePrivateFile } from '@runeditrun/rer/private-files'
import { assertRegular, inspect } from '@runeditrun/rer/local/files'
import { localOperation } from '@runeditrun/rer/local/operation'
import {model,manifest} from './manifest.mjs'
import { ownerDeclaration } from './owner-environment.mjs'
const fields=model.fields
const optionalFields=manifest.fields.filter(field=>['connection','host','identity'].includes(field.group))

export function ownerInputs(env) {
  const missing = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'OPERATOR_EMAIL', 'MAIL_PROVIDER'].filter(key => !env[key]?.trim())
  if (missing.length) { const error = new Error('missing-owner-input'); error.inputs = missing; throw error }
  if (!fields.accountId.valid(env.CLOUDFLARE_ACCOUNT_ID) || !fields.apiToken.valid(env.CLOUDFLARE_API_TOKEN) || !fields.OPERATOR_EMAIL.valid(env.OPERATOR_EMAIL)) throw new Error('invalid-owner-input')
  if (!fields.MAIL_PROVIDER.valid(env.MAIL_PROVIDER)) throw new Error('unsupported-mail-provider')
  if (env.MAIL_PROVIDER === 'later' && env.MAIL_FROM?.trim()) throw new Error('incomplete-mail-provider')
  const timezone = env.WORKSPACE_TIMEZONE || 'UTC'
  if (!fields.WORKSPACE_TIMEZONE.valid(timezone)) throw new Error('invalid-workspace-timezone')
  const credential = env.MAIL_PROVIDER === 'sendgrid' ? 'SENDGRID_API_KEY' : env.MAIL_PROVIDER === 'resend' ? 'RESEND_API_KEY' : undefined
  if (credential) {
    const missing = [credential, 'MAIL_FROM'].filter(key => !env[key]?.trim())
    if (missing.length) { const error = new Error('missing-owner-input'); error.inputs = missing; throw error }
    if (!fields.MAIL_FROM.valid(env.MAIL_FROM)) throw new Error('incomplete-mail-provider')
  }
  if ((env.MAIL_PROVIDER !== 'sendgrid' && env.SENDGRID_API_KEY) || (env.MAIL_PROVIDER !== 'resend' && env.RESEND_API_KEY)) throw new Error('conflicting-mail-provider')
  const eventCredential = env.MAIL_PROVIDER === 'sendgrid' ? 'SENDGRID_EVENT_PUBLIC_KEY' : env.MAIL_PROVIDER === 'resend' ? 'RESEND_WEBHOOK_SECRET' : undefined
  if ((env.MAIL_PROVIDER !== 'sendgrid' && env.SENDGRID_EVENT_PUBLIC_KEY) || (env.MAIL_PROVIDER !== 'resend' && env.RESEND_WEBHOOK_SECRET)) throw new Error('conflicting-mail-provider')
  if (eventCredential && env[eventCredential] !== undefined && (!env[eventCredential].trim() || /[\r\n\0]/.test(env[eventCredential]))) throw new Error('invalid-mail-event-credential')
  if (env.PENNY_EXPECTED_ORIGIN && !fields.APP_ORIGIN.valid(env.PENNY_EXPECTED_ORIGIN)) throw new Error('invalid-expected-owner-origin')
  return { email: env.OPERATOR_EMAIL.toLowerCase(), timezone, provider: env.MAIL_PROVIDER, from: env.MAIL_FROM, credential, eventCredential, expectedOrigin: env.PENNY_EXPECTED_ORIGIN }
}

// Missing first-run inputs are refused without creating private storage. An
// existing file is admitted through Base's regular-file and ownership checks.
export async function ownerConfiguration(root, env, environment = 'production') {
  const target = await ownerDeclaration(root, environment)
  const missing = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].filter(key => !env[key]?.trim())
  if (missing.length) { const error = new Error('missing-owner-input'); error.inputs = missing; throw error }
  const file = target.credentialFile
  for (let length = 1; length <= target.directory.length; length++) {
    const parts = target.directory.slice(0, length)
    const status = await inspect(join(root, ...parts))
    if (status && (!status.isDirectory() || status.isSymbolicLink())) throw new Error('unsafe-owner-settings-directory')
  }
  const status = await inspect(join(root, file))
  assertRegular(status)
  const saved = status ? await readSettings(root, { file, format: 'json' }) : { text: undefined, values: {} }
  const effective = { ...saved.values, ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)) }
  const input = ownerInputs(effective)
  return { ...target, file, saved, effective, input }
}

export async function ownerSettings(root, env, store, { readOnly = false, environment = 'production' } = {}) {
  await ownerConfiguration(root, env, environment)
  const operation = await localOperation(root, env.RER_LOCAL_OPERATION)
  try { return await saveOwnerSettings(root, env, store, readOnly, environment) }
  finally { await operation.release() }
}

async function saveOwnerSettings(root, env, store, readOnly, environment) {
  const { file, saved, effective, input, declaration, declarationFile, stateFile, worker, directory } = await ownerConfiguration(root, env, environment)
  if (saved.values.OPERATOR_EMAIL && saved.values.OPERATOR_EMAIL !== input.email) throw new Error('saved-owner-identity-conflict')
  const generated = Object.fromEntries(manifest.fields.filter(field=>field.kind==='secret'&&field.generate).map(field=>[field.name,saved.values[field.name]??randomBytes(32).toString(field.generate)]))
  if (!Object.values(generated).every(value => /^[a-f0-9]{64}$/.test(value))) throw new Error('invalid-saved-owner-secret')
  const optional=Object.fromEntries(optionalFields.filter(field=>effective[field.name]!==undefined).map(field=>{
    if(!fields[field.name].valid(effective[field.name]))throw new Error('invalid-installation-input')
    if(saved.values[field.name]!==undefined&&saved.values[field.name]!==effective[field.name])throw new Error('saved-owner-configuration-conflict')
    return [field.name,effective[field.name]]
  }))
  const values = { ...saved.values, ...generated,...optional, OPERATOR_EMAIL: input.email, WORKSPACE_TIMEZONE: input.timezone, MAIL_PROVIDER: input.provider, ...(input.credential ? { MAIL_FROM: input.from, [input.credential]: effective[input.credential] } : {}), ...(input.eventCredential && effective[input.eventCredential] ? { [input.eventCredential]: effective[input.eventCredential] } : {}) }
  if (saved.text !== undefined) {
    for (const key of ['MAIL_PROVIDER', 'WORKSPACE_TIMEZONE', 'MAIL_FROM', input.credential, input.eventCredential].filter(Boolean)) if (saved.values[key] !== undefined && values[key] !== saved.values[key]) throw new Error('saved-owner-configuration-conflict')
  }
  store?.addSecrets([optionalFields.filter(field=>field.kind==='secret').map(field=>values[field.name]),Object.values(generated), input.credential && values[input.credential], input.eventCredential && values[input.eventCredential], env.CLOUDFLARE_API_TOKEN])
  if (readOnly && saved.text === undefined) throw new Error('missing-owner-credential-file')
  if (!readOnly && JSON.stringify(values) !== JSON.stringify(saved.values)) {
    await privateDirectory(root, directory)
    await writePrivateFile(join(root, file), JSON.stringify(values, null, 2) + '\n')
  }
  declaration.vars = { ...declaration.vars, OPERATOR_EMAIL: input.email, WORKSPACE_TIMEZONE: input.timezone, ...(input.credential ? { MAIL_PROVIDER: input.provider, MAIL_FROM: input.from } : {}) }
  for(const field of optionalFields)if(values[field.name]){if(field.kind==='secret')declaration.secrets.push({binding:field.name,environment:field.name});else declaration.vars[field.name]=values[field.name]}
  if (input.credential) declaration.secrets.push({ binding: input.credential, environment: input.credential })
  if (input.eventCredential && values[input.eventCredential]) declaration.secrets.push({ binding: input.eventCredential, environment: input.eventCredential })
  if (!readOnly) await writePrivateFile(join(root, declarationFile), JSON.stringify(declaration, null, 2) + '\n')
  return { declaration, declarationFile, stateFile, environment, worker, credentialFile: file, values, input }
}
