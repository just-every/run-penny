import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const code = answer => answer.result?._meta?.['com.runeditrun/error']?.code ?? answer.message?.error?.data?._meta?.['com.runeditrun/error']?.code ?? answer.message?.error?.data?.code;
const assert = (ok, message) => { if (!ok) { console.error('Native journey assertion: ' + message); throw Error(message); } };
export default async function () { console.log('Native journey: conflict, stale version, original key ceiling, native attribution and retained-evidence erasure/restore refusals checked.'); }
export async function afterStep({ phase, step, args, result, tool, request, origin, cookie, database }) {
 if (phase === 'autonomous' && step.id === 'capture') {
  const changed = await tool(step.tool, { ...args, wording: 'A different proposed capture under the same key.' });
  assert(code(changed) === 'idempotency_conflict', 'Changed arguments must conflict');
  const stale = await tool('penny.evidence.update', { id: result.id, operation: 'wording', wording: 'A revision with stale evidence.', expectedVersionId: result.versionId, expected_revision: 'stale-version', idempotency_key: randomUUID() });
  assert(code(stale) === 'revision_conflict', 'A stale native version must refuse');
  const missing = await tool('penny.evidence.get', { id: 'missing-native-evidence' });
  assert(code(missing) === 'resource_unavailable', 'A missing record must not reveal data');
  const scoped = await tool('penny.evidence.get', { id: result.id }, { client: 'local' });
  assert(scoped.status === 403 && code(scoped) === 'insufficient_scope', 'An original key must retain its narrow scope');
  const db = await database('DB');
  const activity = await db.prepare("SELECT a.agent_id,a.prepared_by,a.sponsor_native_id,a.door_operation_id,p.native_operator_id FROM audit_entries a JOIN evidence_items e ON e.id=a.entity_id JOIN penny_agent_people p ON p.actor_id=e.recorded_by_operator_id WHERE a.action='evidence.recorded' AND a.entity_id=?").bind(result.id).first();
  assert(activity?.agent_id && activity.prepared_by.includes(' for ') && activity.sponsor_native_id === activity.native_operator_id && activity.door_operation_id, 'Native activity must retain the real agent and sponsor');
  const erasure = await request(origin + '/api/operator/data/erasure/preview', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ table: 'evidence_items', id: result.id }) });
  assert(erasure.status === 409 && (await erasure.json()).error === 'agent_retained_evidence_requires_review', 'Retained agent evidence must keep native erasure closed');
  const bindingBefore = (await db.prepare('SELECT native_operator_id,actor_id FROM penny_agent_people ORDER BY native_operator_id').all()).results;
  const backup = await request(origin + '/api/operator/data/export', { headers: { Cookie: cookie } });
  assert(backup.ok, 'Native export remains available with retained agent evidence');
  const restore = await request(origin + '/api/operator/data/import', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(await backup.json()) });
  assert(restore.status === 409 && (await restore.json()).error === 'agent_retained_evidence_requires_review', 'Restore cannot displace an admitted sponsor binding');
  assert(JSON.stringify((await db.prepare('SELECT native_operator_id,actor_id FROM penny_agent_people ORDER BY native_operator_id').all()).results) === JSON.stringify(bindingBefore), 'Refused restore must preserve native actor bindings');
 }
 if (phase === 'autonomous' && step.id === 'note') {
  const response = await request(origin + '/api/operator/requests/' + args.slug + '/context', { headers: { Cookie: cookie } });
  assert(response.ok && (await response.json()).notes.some(note => note.id === result.id && note.operator_display_name.includes(' for ')), 'The native note projection must name agent for person');
 }
 if (phase === 'held' && step.id === 'public-board') {
  const db = await database('DB');
  const activity = await db.prepare("SELECT approvers_json,prepared_by FROM audit_entries WHERE action='agent.tool' AND entity_id=?").bind(result.id).first();
  assert(activity && JSON.parse(activity.approvers_json).some(person => person.id && person.name) && activity.prepared_by.includes(' for '), 'The real approver and agent preparer must remain distinct');
  if (process.env.PENNY_AGENT_EVIDENCE) await browserProof({ request, origin, cookie, tool });
 }
}
async function browserProof({ request, origin, cookie, tool }) {
 const pending = await tool('penny.boards.create', { slug: 'review-' + randomUUID().replaceAll('-', ''), name: 'Customer research feedback', visibility: 'public', idempotency_key: randomUUID() });
 const approval = pending.result?._meta?.['com.runeditrun/approval'];
 assert(approval?.id, 'Browser proof needs a real pending approval');
 const { chromium } = await import('@playwright/test');
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'], headless: true });
 const directory = process.env.PENNY_AGENT_EVIDENCE;
 await mkdir(directory, { recursive: true });
 try {
  const context = await browser.newContext();
  await context.addCookies(cookie.split('; ').map(part => { const i = part.indexOf('='); return { name: part.slice(0,i), value: part.slice(i+1), url: origin, secure: true }; }));
  await context.route('**/*', async route => {
   const incoming = route.request(), url = new URL(incoming.url());
   if (url.origin !== origin) return route.abort();
   const headers = new Headers(incoming.headers()); headers.set('Cookie', cookie);
   const response = await request(url.href, { method: incoming.method(), headers, ...(incoming.postDataBuffer() ? { body: incoming.postDataBuffer() } : {}) });
   const output = Object.fromEntries(response.headers); delete output['content-encoding']; delete output['transfer-encoding']; delete output['content-length'];
   await route.fulfill({ status: response.status, headers: output, body: Buffer.from(await response.arrayBuffer()) });
  });
  const page = await context.newPage();
  const capture = async (label, path) => {
   for (const width of [1440,390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    assert(!await page.getByText('Sign in to see agent work.').isVisible(), 'Browser proof must have the native person session');
    if (width === 1440) {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Agent page overflow');
      assert(await page.locator('button,input,select').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).every(element => element.getBoundingClientRect().height >= 44)), 'Agent controls must be at least 44px');
    }
    await page.screenshot({ path: join(directory, label + '-' + width + '.png') });
   }
  };
  await capture('agents-active', '/agents');
  await capture('approval-pending', '/agents/approvals/' + approval.id);
  const view = await request(origin + '/agents/api/approvals/' + approval.id, { headers: { Cookie: cookie } });
  const saved = (await view.json()).approval;
  const rejected = await request(origin + '/agents/api/approvals/' + approval.id + '/reject', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: saved.revision, summary_sha256: saved.summary_sha256 }) });
  assert(rejected.ok, 'Named reviewer must be able to reject'); await rejected.body?.cancel();
  await capture('approval-final', '/agents/approvals/' + approval.id);
  const pause = async paused => {
   const response = await request(origin + '/agents/api/pause', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ paused }) });
   assert(response.ok, 'Native Pause must succeed'); await response.body?.cancel();
  };
  await pause(true);
  try { await capture('agents-paused', '/agents'); } finally { await pause(false); }
  await capture('approval-unavailable', '/agents/approvals/unavailable');
  await context.close();
  console.log('Browser proof: active, pending, final, paused and unavailable at 1440 and 390.');
 } finally { await browser.close(); }
}
