import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const plan = await readFile(new URL('../../FLAGSHIP-PLAN.md', import.meta.url), 'utf8')
const start = plan.indexOf('## Capability status:')
const end = plan.indexOf('## Evidence model and ownership boundaries', start)
const currentSection = start < 0 || end < 0 ? '' : plan.slice(start, end)

test('[REQ-003][DEC-001][ROAD-004][REL-002] flagship status matches implemented workflows and keeps the destination open', () => {
  assert.ok(
    plan.includes("**Status: proposed direction beyond Penny's current 0.0.0 source candidate.**"),
    'the heading must describe the current 0.0.0 source candidate',
  )
  assert.doesNotMatch(plan, /\b(?:82aaf88|83d7da5)\b/)
  assert.ok(currentSection, 'the current capability section and its following boundary must exist')
  assert.match(
    currentSection,
    /^\| Capability \| Current 0\.0\.0 source candidate \| Flagship destination \|$/m,
  )
  assert.doesNotMatch(
    currentSection,
    /read-only application|native sign-in(?:\/sign-out)? is absent|no product write routes|Public reads only; no live mutations|no live deliveries/i,
  )

  const tableRows = currentSection
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  assert.deepEqual(
    tableRows.map(([capability]) => capability),
    [
      'Application and data',
      'Authentication and mutations',
      'Evidence and decision loop',
      'AI and source connections',
      'Roadmap, releases and delivery',
      'Accounts and attachments',
      'Outcomes',
      'Readiness',
    ],
  )
  for (const [capability, current, destination] of tableRows) {
    assert.ok(current, `${capability} needs a current source description`)
    assert.ok(destination, `${capability} needs a flagship destination`)
  }

  const currentByCapability = new Map(tableRows.map(([name, current]) => [name, current]))
  assert.match(currentByCapability.get('Application and data'), /TanStack Start.*Hono.*D1.*R2/i)
  assert.match(currentByCapability.get('Authentication and mutations'), /operator.*sign-in.*sign-out.*requester/i)
  assert.match(currentByCapability.get('Evidence and decision loop'), /record.*evidence.*commit/i)
  assert.match(currentByCapability.get('AI and source connections'), /No AI.*source ingestion.*tracker/i)
  assert.match(currentByCapability.get('Roadmap, releases and delivery'), /roadmap.*status updates.*releases.*notifications/i)
  assert.match(currentByCapability.get('Accounts and attachments'), /existing account.*request attachments.*EVID-008/i)
  assert.match(currentByCapability.get('Outcomes'), /REL-008.*REL-009.*DEC-008.*not implemented/i)
  assert.match(currentByCapability.get('Readiness'), /0\.0\.0.*full contract.*customer outcome/i)

  assert.match(currentSection, /ACCEPTANCE\.md/)
  assert.match(currentSection, /docs\/flagship-acceptance\.md/)
})
