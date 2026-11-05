import { applyD1Migrations, createScheduledController, reset } from 'cloudflare:test'
import { afterEach, beforeEach, expect, inject, it, vi } from 'vitest'
import { createPennyRuntime } from '@/core/app/runtime'
import { runNotificationSchedule } from '@/core/features/notifications/scheduled'
import type { PublicBoard, PublicRequestCard, PublicRequestDetail } from '@/core/shared/api/public'
import { providerMessages } from './provider-messages'
import { captureRejections, localRejectionBindings, rejectionFixture, rejectionRows, rejectionTime } from './rejection-fixture'
import { call, env, mockMail } from './support'

beforeEach(async () => { await reset(); await applyD1Migrations(env.DB, inject('migrations')); mockMail() })
afterEach(() => vi.restoreAllMocks())

type Fixture = Awaited<ReturnType<typeof rejectionFixture>>
async function read<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await call(path, undefined, headers)
  expect(response.status, await response.clone().text()).toBe(200)
  return response.json() as Promise<T>
}

async function publicSiblings(g: Fixture, comment: boolean) {
  const category = async (name: string, parentId?: string) => {
    const response = await call(`/api/operator/boards/${g.board}/categories`, { name, parentId }, g.operator)
    expect(response.status).toBe(201)
    return (await response.json() as { id: string }).id
  }
  expect((await call(`/api/operator/boards/${g.board}`, { categoryMode: 'optional' }, g.operator, 'PATCH')).status).toBe(200)
  const parentId = await category('Review category'), categoryId = await category('Review subcategory', parentId)
  expect((await call(`/api/operator/requests/${g.slug}/category`, { categoryId }, g.operator, 'PATCH')).status).toBe(200)
  const submitted = await call('/api/public/requests', {
    title: 'Approved sibling request', description: 'Approved sibling description', boardSlug: g.board,
    categoryId, idempotencyKey: crypto.randomUUID(),
  }, g.person)
  expect(submitted.status, await submitted.clone().text()).toBe(201)
  const sibling = await submitted.json() as { slug: string }
  expect((await call(`/api/operator/moderation/${sibling.slug}`, {
    verdict: 'approved', title: 'Approved sibling request', description: 'Approved sibling description',
    boardSlug: g.board, categoryId, displayName: 'Approved customer',
  }, g.operator)).status).toBe(200)
  let approvedComment: { id: string } | undefined
  if (comment) {
    const posted = await call(`/api/public/requests/${g.slug}/comments`, { body: 'Approved sibling comment' }, g.person)
    expect(posted.status).toBe(201)
    approvedComment = await posted.json() as { id: string }
    expect((await call(`/api/operator/comments/${approvedComment.id}/moderate`, { verdict: 'approved', publicAuthorDisplayName: 'Approved customer' }, g.operator)).status).toBe(200)
  }
  const slugs = (comment ? [g.slug, sibling.slug] : [sibling.slug]).sort()
  return { approvedCommentId: approvedComment?.id, check: async () => {
    const boards = await read<PublicBoard[]>('/api/public/boards')
    const board = boards.find(row => row.slug === g.board)!
    expect(board).toBeDefined()
    expect(board.requestCount).toBe(comment ? 2 : 1)
    expect(board.categories.map(row => ({ id: row.id, requestCount: row.requestCount })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([parentId, categoryId].sort().map(id => ({ id, requestCount: comment ? 2 : 1 })))
    const payloads: unknown[] = [boards]
    for (const filter of ['', `&category=${parentId}`, `&category=${categoryId}`]) {
      const requests = await read<PublicRequestCard[]>(`/api/public/requests?board=${g.board}${filter}`)
      expect(requests.map(row => row.slug).sort()).toEqual(slugs)
      expect(requests.find(row => row.slug === sibling.slug)).toMatchObject({ title: 'Approved sibling request', commentCount: 0 })
      if (comment) expect(requests.find(row => row.slug === g.slug)).toMatchObject({ title: 'Public request', commentCount: 1 })
      payloads.push(requests)
    }
    const siblingDetail = await read<PublicRequestDetail>(`/api/public/requests/${sibling.slug}`)
    expect(siblingDetail).toMatchObject({ slug: sibling.slug, title: 'Approved sibling request', commentCount: 0, comments: [] })
    payloads.push(siblingDetail)
    if (comment) {
      const detail = await read<PublicRequestDetail>(`/api/public/requests/${g.slug}`)
      expect(detail).toMatchObject({ slug: g.slug, title: 'Public request', commentCount: 1 })
      expect(detail.comments.map(row => ({ id: row.id, body: row.body })))
        .toEqual([{ id: approvedComment!.id, body: 'Approved sibling comment' }])
      payloads.push(detail)
    } else expect((await call(`/api/public/requests/${g.slug}`)).status).toBe(404)
    for (const privateText of [g.title, g.description, g.commentBody, g.reason]) {
      expect(JSON.stringify(payloads)).not.toContain(privateText)
    }
  } }
}

async function authorReadback(g: Fixture, comment: boolean, rejected: boolean, approvedCommentId?: string) {
  const activity = await read<{
    requests: { id: string; slug: string }[]; comments: { id: string }[]
  }>('/api/public/requester/activity', g.person)
  expect(activity.requests).toHaveLength(2)
  expect(activity.requests.find(row => row.id === g.requestId)).toEqual({
    id: g.requestId, slug: g.slug, title: g.title, description: g.description,
    proposedSolution: null, impactStatement: null, withdrawnAt: null,
    moderationState: comment ? 'approved' : rejected ? 'rejected' : 'awaiting_review',
    publicState: comment ? 'open' : 'unpublished', rejectionReason: !comment && rejected ? g.reason : null,
  })
  expect(activity.comments).toHaveLength(comment ? 2 : 0)
  if (comment) {
    expect(activity.comments.find(row => row.id === g.subjectId)).toEqual({
    id: g.subjectId, requestId: g.requestId, slug: g.slug, available: 1, body: g.commentBody,
    moderationState: rejected ? 'rejected' : 'awaiting_review', rejectionReason: rejected ? g.reason : null,
    })
    expect(activity.comments.find(row => row.id === approvedCommentId)).toEqual({
      id: approvedCommentId, requestId: g.requestId, slug: g.slug, available: 1, body: 'Approved sibling comment',
      moderationState: 'approved', rejectionReason: null,
    })
  }
  return activity
}

it('[REQ-030 BASE-OPS-005] private request and comment rejections exclude public totals, retain author reasons and send chosen notices once', async () => {
  const request = await rejectionFixture()
  const comment = await rejectionFixture({ comment: true, operator: request.operator, reason: 'Please describe the expected comment workflow.' })
  const silent = await rejectionFixture({ operator: request.operator })
  const requestPublic = await publicSiblings(request, false), commentPublic = await publicSiblings(comment, true)
  await requestPublic.check(); await commentPublic.check()
  await authorReadback(request, false, false); await authorReadback(comment, true, false, commentPublic.approvedCommentId)
  expect((await request.reject()).status).toBe(200); expect((await comment.reject()).status).toBe(200)
  expect((await silent.reject(false)).status).toBe(200)
  expect((await request.reject()).status).toBe(409); expect((await comment.reject()).status).toBe(409)
  await requestPublic.check(); await commentPublic.check()
  const requestActivity = await authorReadback(request, false, true), commentActivity = await authorReadback(comment, true, true, commentPublic.approvedCommentId)
  for (const [activity, other] of [[requestActivity, comment], [commentActivity, request]] as const) {
    expect(JSON.stringify(activity)).not.toContain(other.requestId)
    expect(JSON.stringify(activity)).not.toContain(other.subjectId)
    expect(JSON.stringify(activity)).not.toContain(other.reason)
  }
  expect((await call('/api/public/requester/activity')).status).toBe(401)

  const bindings = localRejectionBindings(), local = createPennyRuntime(bindings), sent = captureRejections()
  vi.spyOn(Date, 'now').mockReturnValue(rejectionTime)
  await runNotificationSchedule(createScheduledController({ scheduledTime: rejectionTime, cron: '* * * * *' }), bindings)
  await runNotificationSchedule(createScheduledController({ scheduledTime: rejectionTime, cron: '* * * * *' }), bindings)
  expect(sent).toHaveLength(3) // Two rejection notices and the subscribed author's publication notice.
  const allMail = await providerMessages(local)!.list()
  expect(allMail).toHaveLength(3)
  const rejectionIds = new Set((await rejectionRows()).map(row => row.id))
  const mail = allMail.filter(row => rejectionIds.has(row.message.deliveryId))
  expect(mail).toHaveLength(2)
  expect(allMail.filter(row => !rejectionIds.has(row.message.deliveryId))).toHaveLength(1)
  expect(mail.map(row => row.message.to[0]).sort()).toEqual([request.email, comment.email].sort())
  for (const g of [request, comment]) {
    const notice = mail.find(row => row.message.to[0] === g.email)!
    expect(notice.message.text).toContain(g.reason)
    expect(notice.message.text).toContain('/api/public/notifications/unsubscribe?')
    expect(JSON.stringify(notice.message)).not.toMatch(/PRIVATE|COMMERCIAL|HELD/)
  }
  expect(await rejectionRows()).toMatchObject([{ state: 'accepted', attempts: 1 }, { state: 'accepted', attempts: 1 }])
  expect((await call(`/api/public/requests/${request.slug}`)).status).toBe(404)
  expect(await (await call(`/api/public/requests/${comment.slug}`)).text()).not.toContain('PRIVATE HELD COMMENT')
  const inbox = await read<{ deliveries: { kind: string; state: string; provider: string }[] }>('/api/operator/notifications', request.operator)
  expect(inbox.deliveries.filter(d => d.kind === 'rejection')).toMatchObject([{ state: 'accepted', provider: 'sendgrid' }, { state: 'accepted', provider: 'sendgrid' }])
  expect((await call('/api/operator/notifications', undefined, request.person)).status).toBe(401)
  const audits = await env.DB.prepare("SELECT actor_type,actor_id,entity_id,occurred_at,details_json FROM audit_entries WHERE action='moderation.rejection_mail'").all()
  expect(audits.results).toHaveLength(4)
  for (const row of audits.results) {
    expect(row).toMatchObject({ actor_type: 'system', actor_id: 'moderation_rejection_mail', entity_id: expect.any(String), occurred_at: expect.any(String) })
    expect(String(row.details_json)).not.toMatch(/@|Please explain|PRIVATE/)
  }
  await requestPublic.check(); await commentPublic.check()
  await authorReadback(request, false, true); await authorReadback(comment, true, true, commentPublic.approvedCommentId)
})
