import {pennyApi, visibleError} from './penny-api.js';

const el = id => document.getElementById(id);
let client, api, ticketUrl, ticketSnapshot, loading = false, generation = 0, reloadTicket = false;
const requests = new Map();
let boards = [];
function error(value) { el('error').textContent = value; el('error').hidden = !value; }
function invalidate() { el('review').checked = false; el('status').textContent = ''; }
async function run(action) {
  if (loading) return;
  loading = true; el('fields').disabled = true; error(''); el('status').textContent = '';
  try { await action(); } catch (cause) { error(visibleError(cause)); }
  finally {
    loading = false; el('fields').disabled = false;
    if (reloadTicket) { reloadTicket = false; run(loadTicket); }
  }
}
function options(select, rows, label) {
  select.replaceChildren(new Option('Choose…', ''));
  for (const row of rows) select.add(new Option(label(row), row.id ?? row.slug));
}
async function findContacts() {
  invalidate();
  const rows = await api('/api/v1/proxy-vote-contacts?q=' + encodeURIComponent(el('contact-query').value.trim()));
  options(el('customer'), rows, row => `${row.displayName}${row.email ? ` · ${row.email}` : ''}`);
  el('status').textContent = rows.length ? 'Select the customer explicitly.' : 'No customers found. You can confirm a new unverified contact below.';
}
async function ticketData() {
  return client.get(['ticket.id', 'ticket.requester.name', 'ticket.requester.email', 'currentAccount.subdomain']);
}
function snapshot(data) { return JSON.stringify(data); }
async function loadTicket() {
  const current = ++generation;
  el('vote-form').hidden = true;
  const data = await ticketData();
  if (current !== generation) return;
  const id = data['ticket.id'], subdomain = data['currentAccount.subdomain'];
  if (!Number.isSafeInteger(id) || id < 1 || !/^[a-z0-9][a-z0-9-]*$/.test(subdomain)) throw new Error('Open a saved Zendesk ticket to record its source.');
  ticketSnapshot = snapshot(data);
  ticketUrl = `https://${subdomain}.zendesk.com/agent/tickets/${id}`;
  el('ticket-link').href = ticketUrl; el('ticket-link').textContent = `Zendesk ticket #${id}`;
  el('ticket-customer').textContent = [data['ticket.requester.name'], data['ticket.requester.email']].filter(Boolean).join(' · ');
  el('contact-query').value = data['ticket.requester.email'] ?? '';
  el('display-name').value = data['ticket.requester.name'] ?? '';
  el('email').value = data['ticket.requester.email'] ?? '';
  el('new-contact').checked = false; el('confirm-contact').checked = false; toggleNew();
  el('customer').replaceChildren(new Option('Choose a customer…', ''));
  el('source').value = ''; el('importance').value = ''; invalidate(); el('vote-form').hidden = false;
  el('status').textContent = 'Find and select the customer, or confirm a new contact.';
}
function toggleNew() {
  const active = el('new-contact').checked;
  el('new-fields').hidden = !active; el('customer').disabled = active;
  el('display-name').required = active; el('confirm-contact').required = active;
  el('email').disabled = !active; el('display-name').disabled = !active; el('confirm-contact').disabled = !active;
  if (active) el('customer').value = '';
  invalidate();
}
el('new-contact').addEventListener('change', toggleNew);
el('fields').addEventListener('input', event => { if (event.target.id !== 'review') invalidate(); });
el('fields').addEventListener('change', event => { if (event.target.id !== 'review') invalidate(); });
el('find-contact').addEventListener('click', () => run(findContacts));
el('find-request').addEventListener('click', () => run(async () => {
  invalidate();
  const [rows, currentBoards] = await Promise.all([api('/api/v1/requests?q=' + encodeURIComponent(el('request-query').value.trim())),api('/api/v1/boards')]);
  boards = currentBoards;
  requests.clear(); for (const row of rows) requests.set(row.slug, row);
  options(el('request'), rows.map(row => ({...row, id: row.slug})), row => row.title);
  el('request-status').textContent = '';
  el('status').textContent = rows.length ? 'Choose the request this customer supports.' : 'No published requests found.';
}));
el('request').addEventListener('change', () => {
 const row = requests.get(el('request').value);
 el('request-status').textContent = row ? `Public status: ${row.statusLabel ?? row.status}` : '';
 const choices = boards.find(board => board.slug === row?.board.slug)?.importanceChoices ?? [];
 el('importance-field').hidden = !choices.length;
 options(el('importance'), choices.map((label,index)=>({id:String(index+1),label})),item=>item.label);
});
el('vote-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    if (snapshot(await ticketData()) !== ticketSnapshot) { await loadTicket(); throw new Error('The ticket requester changed. Review the current customer and source again.'); }
    if (!el('review').checked || !requests.has(el('request').value)) throw new Error('Choose a request and review the customer and source.');
    const newContact = el('new-contact').checked;
    if (newContact ? !el('confirm-contact').checked : !el('customer').value) throw new Error('Select an existing customer or confirm a new unverified contact.');
    const email = el('email').value.trim();
    const identity = newContact ? {contact: {displayName: el('display-name').value.trim(), ...(email ? {email} : {})}} : {requesterId: el('customer').value};
    const result = await api(`/api/v1/requests/${encodeURIComponent(el('request').value)}/proxy-votes`, {...identity, source: el('source').value.trim(), sourceUrl: ticketUrl,...(!el('importance-field').hidden&&el('importance').value?{importance:Number(el('importance').value)}:{})});
    el('review').checked = false;
    if (newContact) { el('new-contact').checked = false; toggleNew(); el('contact-query').value = email || el('display-name').value; await findContacts(); el('customer').value = result.requesterId; }
    el('status').textContent = result.created ? 'Customer vote recorded. No identity verification or email subscription was created.' : 'This customer already supports this request. No additional vote was recorded.';
  });
});
async function init() {
  if (!window.ZAFClient) throw new Error('The Zendesk Apps framework did not load. Reopen this app inside a Zendesk ticket.');
  client = window.ZAFClient.init();
  const metadata = await client.metadata(); api = pennyApi(client, metadata.settings);
  await loadTicket();
  for (const event of ['ticket.requester.id.changed', 'ticket.requester.email.changed', 'ticket.requester.name.changed']) client.on(event, () => {
    generation++; invalidate(); el('vote-form').hidden = true;
    if (loading) reloadTicket = true; else run(loadTicket);
  });
  const resize = () => client.invoke('resize', {height: `${Math.min(document.documentElement.scrollHeight + 12, 1800)}px`}).catch(() => error('Zendesk could not resize the sidebar. Reopen the app.'));
  new ResizeObserver(resize).observe(document.body);
}
init().catch(cause => { el('status').textContent = ''; error(visibleError(cause)); });
