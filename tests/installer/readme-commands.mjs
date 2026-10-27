import assert from 'node:assert/strict'
const block = (readme, name) => readme.match(new RegExp(`<!-- ${name} -->\\s*\`\`\`bash\\n([\\s\\S]+?)\\n\`\`\`\\s*<!-- \\/${name} -->`))?.[1]?.trim().split('\n')
export function readmeCommands(readme, email) {
  // The start command is the Run page's one line; the owner block adds setup under a real email.
  const start = block(readme, 'penny-local-commands'), owner = block(readme, 'penny-owner-commands')
  assert.ok(start && owner, 'README has the start and owner command blocks')
  assert.ok(start.length, 'README supplies a start command')
  const lines = owner.map(line => {
    const command = line.replace('you@example.com', email).split(' ')
    if (command[0] === 'npx' && command[1] === '-y' && command[2] === '@runeditrun/rer') return command.slice(3)
    if (command[0] === 'rer') return command.slice(1)
    throw new Error('README owner commands must invoke rer or its npx launcher')
  })
  // Execute the documented commands without an implicit install or repair first.
  // The public launcher must bootstrap the frozen dependencies for setup itself.
  return lines
}
