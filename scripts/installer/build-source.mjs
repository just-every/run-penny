// Both entry points execute the same real build commands. Their caller owns
// Base's private-settings lock and captured command store for the whole build.
export async function buildSource(run, { predecessor = false } = {}) {
  await run('pnpm', ['exec', 'tsc', '-b'])
  await run('pnpm', ['exec', 'vite', 'build', ...(predecessor ? ['--config', 'vite.predecessor.config.ts'] : [])])
}
