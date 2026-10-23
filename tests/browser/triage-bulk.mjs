import assert from 'node:assert/strict'

// Called once per viewport by the ownership journey, after owner setup.
// inspect has the existing audit(page, label, {detail}) contract. The caller
// retains browser console, pageerror, external-request checks and teardown.
export async function proveBulkActions({ page, runtime, viewport, inspect }) {
  const { origin } = runtime
  const width = typeof viewport === 'number' ? viewport : viewport.width
  async function json(path, body, expected = 200) {
    const response = await page.request.fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin },
      ...(body === undefined ? {} : { data: body }),
    })
    assert.equal(response.status(), expected, `[TRIAGE-005] ${path}`)
    return response.json()
  }
  const boardSlug = `bulk-finance-${width}`
  const [, tag, options] = await Promise.all([
    json('/api/operator/boards', { slug: boardSlug, name: 'Finance follow-up', visibility: 'public' }, 201),
    json('/api/operator/catalog/tags', { name: 'Finance review follow-up' }, 201),
    json('/api/operator/triage/batches/options'),
  ])
  assert.equal(options.canManage, true)
  const assignee = options.operators[0]
  assert.ok(assignee, '[TRIAGE-005] an active operator is available')
  const requests = await Promise.all([
    'Schedule monthly finance exports',
    'Include invoice currency in billing reports',
    'Send department spending summaries',
  ].map(title => json('/api/operator/requests', {
    title, description: 'The finance team needs this workflow before its next month-end review.', boardSlug,
  }, 201)))
  async function snapshot(request) {
    const [ownership, tags] = await Promise.all([
      json(`/api/operator/ownership/requests/${request.slug}`),
      runtime.db.prepare('SELECT tag_id FROM request_tag_assignments WHERE request_id=? ORDER BY tag_id').bind(request.id).all(),
    ])
    return { ownerId: ownership.owner?.id ?? null, tags: tags.results.map(row => row.tag_id) }
  }
  const before = await Promise.all(requests.map(snapshot))
  await page.goto(origin + `/app/moderation?board=${boardSlug}`)
  const bulk = page.getByRole('region', { name: 'Bulk request actions', exact: true })
  const selectPage = bulk.getByRole('button', { name: 'Select current page', exact: true })
  await selectPage.click()
  for (const request of requests) assert.equal(await page.getByRole('checkbox', { name: `Select ${request.title}`, exact: true }).isChecked(), true)
  await bulk.getByRole('button', { name: 'Clear current page', exact: true }).click()
  for (const request of requests) {
    const checkbox = page.getByRole('checkbox', { name: `Select ${request.title}`, exact: true })
    assert.equal(await checkbox.isChecked(), false)
    await checkbox.check()
  }
  const form = bulk.getByRole('form', { name: 'Apply bulk request changes', exact: true })
  await form.getByLabel('Add tag (optional)', { exact: true }).selectOption(tag.id)
  await form.getByLabel('Assign owner (optional)', { exact: true }).selectOption(assignee.id)
  await bulk.getByRole('status').filter({ hasText: /^3 selected/ }).waitFor()
  assert.deepEqual(await page.locator('main button').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&!node.textContent.trim()).map(node=>node.getAttribute('aria-label')??'unnamed')), [], '[TRIAGE-005] visible actions name themselves; no icon-only control needs a tooltip')
  await inspect(page, 'bulk-review', { detail: bulk })
  const batchResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/operator/triage/batches' && response.request().method() === 'POST')
  await form.getByRole('button', { name: 'Apply batch', exact: true }).click()
  const response = await batchResponse
  assert.equal(response.status(), 201)
  const batch = await response.json()
  assert.equal(batch.selected, requests.length)
  assert.equal(batch.changed, requests.length)
  const summary = bulk.getByRole('status').filter({ hasText: /^Batch changed 3 of 3 selected requests/ })
  await summary.waitFor()
  assert.equal(await summary.count(), 1, '[TRIAGE-005] one visible batch summary')
  for (const request of requests) {
    const saved = await snapshot(request)
    assert.equal(saved.ownerId, assignee.id)
    assert.ok(saved.tags.includes(tag.id))
    const ownerField = page.locator(`#request-${request.slug}`).getByRole('combobox', { name: 'Accountable owner', exact: true })
    await ownerField.waitFor()
    assert.equal(await ownerField.inputValue(), assignee.id)
  }
  await inspect(page, 'bulk-changed', { detail: bulk })
  const undoResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/operator/triage/batches/${batch.id}/undo` && response.request().method() === 'POST')
  await bulk.getByRole('button', { name: 'Undo batch', exact: true }).click()
  const undoneResponse = await undoResponse
  assert.equal(undoneResponse.status(), 200)
  const undone = await undoneResponse.json()
  assert.equal(undone.restored, requests.length)
  assert.equal(undone.skipped, 0)
  await bulk.getByRole('status').filter({ hasText: /^Undo complete: 3 restored; 0 skipped/ }).waitFor()
  assert.equal(await summary.count(), 1, '[TRIAGE-005] batch summary survives list refresh and undo')
  assert.deepEqual(await Promise.all(requests.map(snapshot)), before, '[TRIAGE-005] undo restores native tag and owner state')
  for (const [index, request] of requests.entries()) {
    const ownerField = page.locator(`#request-${request.slug}`).getByRole('combobox', { name: 'Accountable owner', exact: true })
    await ownerField.waitFor()
    assert.equal(await ownerField.inputValue(), before[index].ownerId ?? '')
  }
  await inspect(page, 'bulk-undone', { detail: bulk })
}
