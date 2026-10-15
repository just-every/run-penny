import assert from 'node:assert/strict'
const block = (readme, name) => readme.match(new RegExp(`<!-- ${name} -->\\s*\`\`\`bash\\n([\\s\\S]+?)\\n\`\`\`\\s*<!-- \\/${name} -->`))?.[1]?.trim().split('\n')
export function readmeCommands(readme, email) {
  // The start commands are the Run page's two lines; the owner block adds setup under a real email.
  const start = block(readme, 'penny-local-commands'), owner = block(readme, 'penny-owner-commands')
  assert.ok(start && owner, 'README has the start and owner command blocks')
  assert.match(start[0], /^git clone https:\/\/github\.com\/just-every\/run-penny\.git$/, 'README starts from a clone')
  assert.equal(start[1], 'cd run-penny && rer dev', 'README starts Penny with rer dev')
  const lines = owner.map(line => line.replace('you@example.com', email).split(' '))
  assert.ok(lines.every(([command]) => command === 'rer'), 'README owner commands run rer')
  assert.deepEqual(lines.map(line => line[1]), ['setup', 'dev'], 'README owner commands set up, then start')
  // Each command's verb and flags, run by the pinned rer as a global rer runs them:
  // the frozen install rer dev performs first, then the owner's setup and dev.
  return [['install'], ...lines.map(line => line.slice(1))]
}
