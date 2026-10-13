import assert from 'node:assert/strict'
export function readmeCommands(readme, email) {
  const block = readme.match(/<!-- penny-local-commands -->\s*```bash\n([\s\S]+?)\n```\s*<!-- \/penny-local-commands -->/)?.[1]
  assert.ok(block, 'README has an executable local command block')
  return block.trim().split('\n').map(line => line.replace('you@example.com', email).split(' ').slice(1))
}
