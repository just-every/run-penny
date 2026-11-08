import { z } from 'zod'

const text = z.string(), nullableText = text.nullable(), count = z.number().int().nonnegative()
const named = z.object({ id: text, name: text }).strict()
const boardReference = z.object({ slug: text, name: text }).strict()
const category = named.extend({ parent: named.nullable() }).strict().nullable()
const status = z.enum(['open', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'])
export const publicComment = z.object({
  id: text, author: z.object({ displayName: text, kind: z.enum(['requester', 'operator']) }).strict(),
  body: text, publishedAt: text,
}).strict()
export const publicStatus = z.object({
  id: text, status: z.union([status, z.literal('withdrawn')]), body: text,
  pinned: z.union([z.literal(0), z.literal(1)]), publishedAt: text,
}).strict()
export const requestCard = z.object({
  slug: text, board: boardReference, title: text, description: text, status,
  publicEta: nullableText, statusLabel: nullableText, category, voteCount: count.optional(),
  commentCount: count, publishedAt: text, recentActivityAt: text,
}).strict()
const requestDetail = requestCard.extend({
  authorDisplayName: nullableText, commentsAllowed: z.boolean(), showVoters: z.boolean(),
  voters: z.array(z.object({ displayName: text }).strict()).optional(),
  comments: z.array(publicComment), statusUpdates: z.array(publicStatus),
  attachments: z.array(z.object({ id: text, filename: text, contentType: text }).strict()),
}).strict()
export const responses = {
  Error: z.object({ error: text, message: text.optional() }).strict(),
  Boards: z.array(boardReference.extend({
    requestCount: count, categoryMode: z.enum(['off', 'optional', 'required']),
    postingPolicy: z.enum(['requesters', 'operators']), commentsAllowed: z.boolean(),
    showVoteCounts: z.boolean(), showVoters: z.boolean(), anonymousRequesters: z.boolean(),
    importanceChoices: z.array(text),
    categories: z.array(named.extend({ parentId: nullableText, position: z.number(), archived: z.boolean(), requestCount: count }).strict()),
    subscriptionDisclosure: z.object({ enabled: z.boolean(), version: z.number().int(), vote: nullableText, submission: nullableText }).strict(),
  }).strict()),
  Requests: z.array(requestCard),
  Request: z.union([
    z.object({ kind: z.literal('found'), request: requestDetail }).strict(),
    z.object({ kind: z.literal('redirect'), slug: text }).strict(),
    z.object({ kind: z.literal('withdrawn') }).strict(),
  ]),
  Comments: z.array(publicComment),
  StatusUpdates: z.array(publicStatus),
  CreatedRequest: z.object({ id: text, slug: text }).strict(),
  CreatedComment: z.object({ id: text }).strict(),
  PublishedStatus: z.object({ published: z.literal(true) }).strict(),
  Contacts: z.array(z.object({ id: text, displayName: text, email: nullableText }).strict()),
  ProxyVote: z.object({ requesterId: text, created: z.boolean() }).strict(),
  CreatedRelease: z.object({ id: text, slug: text, versionId: text }).strict(),
  PublishedRelease: z.object({ id: text, versionId: text }).strict(),
}
const release = z.object({
  slug: text, versionNumber: z.number().int(), title: text, releaseType: z.enum(['new', 'improved', 'fixed']),
  body: text, publicationDate: text, setupUrl: nullableText, authorName: text,
  labels: z.array(named), products: z.array(named), isCurrent: z.literal(true),
}).strict()
export const releaseResponses = { Release: release, Releases: z.array(release) }
