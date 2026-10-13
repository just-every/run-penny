import { describeOperations, validateEnvironmentSources } from './operations.mjs'
import { readProjectOperations, inspectRequiredLoops } from './project-operations.mjs'
import { validateConfiguration } from './operations-config.mjs'
import { ownerInputs } from './installer/owner-settings.mjs'

// Penny selects its product mode; Base validates the resulting descriptor and
// checks command files, environment sources and declared loops unchanged.
export async function inspectProfile(root, name, env = process.env) {
  const descriptor = await describeOperations(root)
  const profile = descriptor.profiles?.[name]
  if (!profile) throw new Error('unknown-operations-profile')
  const selected = { ...descriptor, ...profile }
  const { commands } = await readProjectOperations(root, selected, validateEnvironmentSources)
  const loops = inspectRequiredLoops(selected, env)
  const missingEnvironment = selected.requiredEnvironment.filter(key => !env[key]?.trim())
  let configuration = 'valid'
  try {
    if (name.startsWith('owner-')) {
      ownerInputs(env)
      if (env.MAIL_PROVIDER !== name.slice(6)) throw new Error('wrong-provider')
    } else if (name.startsWith('runtime-')) {
      validateConfiguration(env)
      if (env.MAIL_PROVIDER !== name.slice(8)) throw new Error('wrong-provider')
    } else if (name.startsWith('artifact-') && name !== 'artifact-prepare') {
      const provider = name.slice(9)
      if (env.MAIL_PROVIDER !== provider || !/^[a-f0-9]{32}$/i.test(env.CF_THROWAWAY_ACCOUNT_ID ?? '') || !/^[a-f0-9]{64}$/.test(env.RER_DEPLOY_ARTIFACT_SHA256 ?? '') || !/^[a-f0-9]{40}$/.test(env.RER_DEPLOY_SOURCE_SHA ?? '')) throw new Error('invalid-artifact-input')
    }
  } catch { configuration = 'invalid' }
  return { version: 2, project: descriptor.project, profile: name, scope: 'local-inputs-only', commands, loops, missingEnvironment, configuration,
    ok: commands.every(command => command.available) && !missingEnvironment.length && configuration === 'valid' && loops.every(loop => ['ready', 'optional-disabled'].includes(loop.status)),
    environmentSources: selected.environmentSources,
    unchecked: ['saved owner credentials and state', 'provider identity and permissions', 'resource provisioning', 'hosted health, Cron and inbox delivery'],
  }
}

export function profileSummary(result) {
  const missing = [...new Set([...result.missingEnvironment, ...result.loops.flatMap(loop => loop.missingEnvironment)])]
  return (missing.length ? ['Missing inputs are expected before a deployment is configured.', ...missing.map(key => `${key} — ${result.environmentSources[key] ?? 'See OPERATIONS.md'}`)] : [result.ok ? 'Operations check passed for the selected local profile.' : 'Selected profile has invalid configuration. Values are suppressed.']).join('\n')
}
