import assert from 'node:assert/strict'
export function readmeCommands(readme, email) {
  const block = readme.match(/<!-- penny-local-commands -->\s*```bash\n([\s\S]+?)\n```\s*<!-- \/penny-local-commands -->/)?.[1]
  assert.ok(block, 'README has an executable local command block')
  const lines = block.trim().split('\n').map(line => line.replace('you@example.com', email).split(' '))
  assert.ok(lines.every(([command]) => command === 'rer'), 'README local commands run rer')
  // Each command's verb and flags, run by the pinned rer as a global rer runs them.
  return lines.map(line => line.slice(1))
}
