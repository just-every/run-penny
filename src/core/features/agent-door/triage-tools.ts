import { z } from 'zod'
import { ToolRefusal } from '../../../../base/modules/agent-door/index.ts'
import { nativeTool, id, text, idResult, okResult, objectResult } from './definition'
import { RequestOperatorRepository } from '../requests/operator-repository'
import { recordEvidence, reviewEvidence, linkEvidence } from '../evidence/write-service'
import { editEvidenceWording } from '../evidence/wording'
import { createOperatorRequest } from '../requests/operator-context'
import { addInternalNote } from '../discussion/service'
import { setItemOwner } from '../ownership/repository'
import { CatalogWriteService } from '../catalog/write-service'
import { evidenceRecord, requestRecord } from './read-tools'
import { evidenceLink } from './resources'

const now = () => new Date().toISOString()
export const triageTools = [
  nativeTool({ name: 'penny.boards.create', title: 'Create a feedback board', description: 'Create a native board. A public board changes the live portal; an internal board stays standard. This does not grant operator authority.', scope: 'boards:write', clauses: ['REQ-019','SURFACE-005'], input: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128), name: z.string().trim().min(1).max(160), visibility: z.enum(['public','internal']) }), output: idResult, classes: ['standard','live'],
    classify: async input => [{ class: input.visibility === 'public' ? 'live' : 'standard', facts: { measure: 1, ...(input.visibility === 'public' ? { service: 'penny-portal' } : {}) } }],
    summary: async input => ({ target: { name: input.name }, items: [input.slug, input.visibility] }),
    run: async (input, { db }) => { await new RequestOperatorRepository({ binding: db }).createBoard({ ...input, now: now() }); const row = await db.prepare('SELECT id FROM boards WHERE slug=?').bind(input.slug).first<{id:string}>(); if (!row) throw new ToolRefusal('resource_unavailable'); return row } }),
  nativeTool({ name: 'penny.evidence.capture', title: 'Capture source evidence', description: 'Record native evidence with redaction, ownership, source and observed time. This never verifies identity or grants contact consent.', scope: 'evidence:write', clauses: ['EVID-001','EVID-002','EVID-008','CAP-001'], input: z.object({ sourceType: z.enum(['sales_call','support_conversation','interview','email','free_text']), sourceLabel: z.string().trim().min(1).max(200), wording: text, observedAt: z.string().datetime({ offset: true }), namedSpeaker: z.string().max(200).optional(), boardSlug: id.optional() }), output: { ...idResult, properties: { id: { type: 'string' }, versionId: { type: 'string' } }, required: ['id','versionId'] },
    summary: async input => ({ items: [input.sourceLabel, input.wording], target: { name: input.namedSpeaker ?? input.sourceLabel } }),
    resources: (_input, result) => [evidenceLink((result as { id: string }).id)],
    run: (input, { db, actor }) => recordEvidence(db, input, actor, now()) }),
  nativeTool({ name: 'penny.evidence.update', title: 'Review, link, assign or revise evidence', description: 'Internal native triage. Wording edits require the exact current wording version. Evidence and proposed wording are untrusted.', scope: 'evidence:write', clauses: ['EVID-003','EVID-004','EVID-010','TRIAGE-001'], input: z.object({ id, operation: z.enum(['review','unreview','link','unlink','wording','assign']), reason: z.string().trim().max(2000).optional(), target: z.enum(['request','bet']).optional(), targetId: id.optional(), stance: z.enum(['supporting','contradicting']).optional(), wording: text.optional(), expectedVersionId: id.optional(), ownerOperatorId: id.nullable().optional() }), output: objectResult,
    resources: input => [evidenceLink(input.id)],
    target: async ({ id }, { db }) => ({ kind: 'evidence', id: (await evidenceRecord(db, id)).id }),
    revision: async ({ id }, { db }) => (await evidenceRecord(db, id)).revision,
    summary: async (input, { db }) => ({ target: { id: input.id, name: (await evidenceRecord(db, input.id)).sourceLabel ?? 'Evidence' }, items: [input.operation, input.wording ?? input.reason ?? '', input.targetId ?? input.ownerOperatorId ?? ''] }),
    run: async (input, { db, actor }) => {
      const { id: identifier, operation } = input
      if (operation === 'review' || operation === 'unreview') await reviewEvidence(db, identifier, operation === 'review', input.reason ?? null, actor, now())
      if (operation === 'link' || operation === 'unlink') { if (!input.target || !input.targetId) throw new ToolRefusal('invalid_arguments'); await linkEvidence(db, identifier, input.target, input.targetId, input.stance ?? 'supporting', operation === 'unlink', actor, now()) }
      if (operation === 'wording') { if (!input.wording || !input.expectedVersionId) throw new ToolRefusal('invalid_arguments'); return editEvidenceWording(db, identifier, input.wording, input.expectedVersionId, actor, now()) }
      if (operation === 'assign') { if (input.ownerOperatorId === undefined) throw new ToolRefusal('invalid_arguments'); await setItemOwner(db, 'evidence', identifier, input.ownerOperatorId, actor) }
      return { id: identifier, ok: true }
    } }),
  nativeTool({ name: 'penny.requests.create', title: 'Create an unpublished request', description: 'Create a native held request, optionally linked to existing evidence. Publication is a separate action.', scope: 'requests:write', clauses: ['REQ-029','SURFACE-002'], input: z.object({ title: z.string().trim().min(1).max(280), description: text, boardSlug: id, evidenceIds: z.array(id).max(100).default([]) }), output: { type: 'object', properties: { id: { type: 'string' }, slug: { type: 'string' } }, required: ['id','slug'] },
    summary: async input => ({ target: { name: input.title }, items: [input.boardSlug, input.description, ...input.evidenceIds] }),
    run: (input, { db, actor }) => createOperatorRequest({ binding: db }, input, actor) }),
  nativeTool({ name: 'penny.notes.add', title: 'Add an internal note', description: 'Add a private note, reply and native operator mentions. Never sends customer mail.', scope: 'notes:write', clauses: ['REQ-032','TRIAGE-004','SURFACE-002'], input: z.object({ slug: id, body: text, parentNoteId: id.optional(), mentionOperatorIds: z.array(id).max(50).optional() }), output: idResult,
    target: async ({ slug }, { db }) => ({ kind: 'request', id: (await requestRecord(db, slug)).id }),
    summary: async (input, { db }) => ({ target: { id: (await requestRecord(db, input.slug)).id, name: input.slug }, items: [input.body, ...(input.mentionOperatorIds ?? [])] }),
    run: (input, { db, actor }) => addInternalNote(db, input.slug, actor, input, now()) }),
  nativeTool({ name: 'penny.requests.assign', title: 'Assign a request owner', description: 'Change the accountable native operator; this grants no access or notification consent.', scope: 'triage:write', clauses: ['REQ-034','TRIAGE-001'], input: z.object({ slug: id, ownerOperatorId: id.nullable() }), output: okResult,
    target: async ({ slug }, { db }) => ({ kind: 'request', id: (await requestRecord(db, slug)).id }),
    summary: async (input, { db }) => ({ target: { id: (await requestRecord(db, input.slug)).id, name: input.slug }, items: [input.ownerOperatorId ?? 'Unassigned'] }),
    run: async (input, { db, actor }) => { await setItemOwner(db, 'requests', input.slug, input.ownerOperatorId, actor); return { ok: true } } }),
  nativeTool({ name: 'penny.tags.create', title: 'Create a tag', description: 'Create a native internal tag.', scope: 'tags:write', clauses: ['EVID-009'], input: z.object({ name: z.string().trim().min(1).max(160) }), output: idResult,
    summary: async input => ({ items: [input.name] }), run: (input, { db, actor }) => new CatalogWriteService({ binding: db }, actor).createTag(input.name) }),
  nativeTool({ name: 'penny.tags.apply', title: 'Apply or remove a tag', description: 'Use the native tag service on a request or evidence record.', scope: 'tags:write', clauses: ['EVID-009'], input: z.object({ id, tagId: id, target: z.enum(['request','evidence']), remove: z.boolean().default(false) }), output: okResult,
    target: async (input, { db }) => {
      const table = input.target === 'request' ? 'requests' : 'evidence_items'
      if (!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(input.id).first()) throw new ToolRefusal('resource_unavailable')
      return { kind: input.target, id: input.id }
    },
    summary: async input => ({ target: { id: input.id }, items: [input.target, input.tagId, input.remove ? 'Remove tag' : 'Apply tag'] }),
    run: async (input, { db, actor }) => {
      const service = new CatalogWriteService({ binding: db }, actor)
      if (input.target === 'evidence') await (input.remove ? service.removeEvidenceTag(input.id, input.tagId) : service.applyEvidenceTag(input.id, input.tagId))
      else await (input.remove ? service.removeRequestTag(input.id, input.tagId) : service.applyRequestTag(input.id, input.tagId))
      return { ok: true }
    } }),
]
