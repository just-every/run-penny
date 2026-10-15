// The installer executes the real build commands while its caller owns
// Base's private-settings lock and captured command store for the whole build.
export async function buildSource(run) {
  await run('pnpm', ['exec', 'tsc', '-b'])
  await run('pnpm', ['exec', 'vite', 'build'])
}
