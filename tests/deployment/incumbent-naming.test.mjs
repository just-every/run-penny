import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Every seed's homepage says it is a "100% free, open source
// alternative to ..." the products it replaces, and `replaces` in seed.json lists them. That is nominative use. The
// catalogue text beside it stays free of incumbent names and of comparative claims.
const replaced = ['Canny', 'UserVoice', 'Productboard']
const incumbents = [...replaced, 'Zendesk', 'Intercom', 'Help Scout', 'HubSpot', 'Pipedrive', 'Mailchimp', 'Notion', 'Linear', 'Jira', 'Airtable', 'Typeform', 'Calendly', 'Statuspage', 'Asana', 'monday.com', 'Salesforce', 'Freshdesk', 'Confluence']
const comparative = /\b(better than|worse than|cheaper than|faster than|superior to|beats|unlike|instead of|replaces?|outperforms?|no longer need|switch from)\b/i
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const names = (text) => incumbents.filter((name) => new RegExp(`(?<![\\w])${escape(name)}(?![\\w])`, 'i').test(text))
const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8')

test('[REL-001] seed.json replaces lists the three products the homepage names', async () => {
  const seed = JSON.parse(await read('seed.json'))
  assert.deepEqual(seed.replaces, replaced)
})

test('[REL-001] catalogue text names no incumbent and makes no comparative claim', async () => {
  const seed = JSON.parse(await read('seed.json'))
  const text = JSON.stringify({ name: seed.name, description: seed.description, capabilities: seed.capabilities, nonGoals: seed.nonGoals, scope: seed.scope })
  assert.deepEqual(names(text), [])
  assert.doesNotMatch(text.replace(/"id":"[^"]*"/g, ''), comparative)
})

test('[HOME-002] the homepage names the replaced products only as "alternative to" and makes no comparative claim', async () => {
  const copy = await read('src/core/features/landing/copy.ts')
  const line = '100% free, open source alternative to Canny, UserVoice and Productboard'
  assert.equal(copy.split(line).length - 1, 1, 'the meta description carries the full sentence')
  const lead = "alternative: { lead: '100% free, open source alternative to', names: ['Canny', 'UserVoice', 'Productboard'] }"
  assert.equal(copy.split(lead).length - 1, 1, 'the hero carries the same sentence as a lead and the three names')
  const rest = copy.split(line).join('').split(lead).join('')
  assert.deepEqual(names(rest), [])
  assert.doesNotMatch(rest, /\b(better than|worse than|cheaper than|faster than|superior to|beats|unlike|outperforms?)\b/i)
})
