import { randomUUID } from 'node:crypto';
/** Native HTTP writes create fresh phase-local records and original scoped keys. */
export default async function ({ phase, request, origin, cookie }) {
 const native = async (path, body, method = 'POST') => {
  const response = await request(origin + path, { method, headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw Error('Native fixture lifecycle failed');
  return response.json();
 };
 const actor = (await native('/api/auth/session', undefined, 'GET')).operator;
 const slug = () => 'agent-' + randomUUID().replaceAll('-', '');
 const board = slug(), publicBoard = slug();
 await native('/api/operator/boards', { slug: board, name: 'Agent triage ' + phase, visibility: 'internal' });
 await native('/api/operator/boards', { slug: publicBoard, name: 'Customer feedback ' + phase, visibility: 'public' });
 const published = await native('/api/operator/requests', { title: 'Customer feedback fixture', description: 'Public customer-safe wording.', boardSlug: publicBoard, evidenceIds: [] });
 await native('/api/operator/requests/' + published.slug + '/moderate', { verdict: 'approved' });
 const captureSnooze = () => native('/api/operator/evidence', { sourceType: 'free_text', sourceLabel: 'Synthetic triage ' + phase, wording: 'Evidence waiting for follow-up.', observedAt: new Date().toISOString() });
 const snooze = { id: (await captureSnooze()).id, httpId: (await captureSnooze()).id, until: new Date(Date.now() + 7 * 86400000).toISOString() };
 const issued = await native('/api/operator/integrations/keys', { name: 'Synthetic scoped capture', scopes: ['requests:write'] });
 return { values: { snooze, board: { slug: board }, actor: { id: actor.id }, tag: { name: 'Triage ' + randomUUID() }, internalBoard: { slug: slug() }, publicBoard: { slug: slug() }, published },
  clients: { local: { token: issued.token, clientId: 'penny-api/' + issued.credential.id, agent: { id: 'penny-key-' + issued.credential.id, name: issued.credential.name, specialist: 'feedback-triager' } } } };
}
