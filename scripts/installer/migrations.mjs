import { commandEnvironment } from './settings.mjs'
export async function applyMigrations(context) {
  const env = { ...commandEnvironment(), PENNY_LOCAL_STATE: context.stateDirectory, CI: '1' }
  await context.run('Applying local migrations', 'pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'feedback-penny-local', '--local', '--persist-to', context.stateDirectory], { env })
}
