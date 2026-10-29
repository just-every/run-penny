import { z } from 'zod'
import { ToolRefusal } from '../../../../base/modules/agent-door/index.ts'
import { nativeTool, id, text, idResult, objectResult, okResult } from './definition'
import { createDecision, editDecision, saveBet } from '../decisions/write-service'
import { commitDecision } from '../decisions/commit'
import { reviewDecision } from '../decisions/reviews'
import { decisionHistory } from '../decisions/history'
import { workspaceReadService } from '../workspace/service'
import { saveHierarchy, linkFeature, readHierarchy } from '../hierarchy/repository'
import { viewInput } from '../prioritisation/formulas'
import { readView, saveView } from '../prioritisation/repository'
import { saveAccount } from '../accounts/write-service'

const now = () => new Date().toISOString()
const confidence = z.enum(['low','medium','high'])
const decisionInput = z.object({ question: text, ownerOperatorId: id.optional(), confidence: confidence.optional(), reviewAt: id.optional() })
const commitInput = z.object({ id, selectedCandidateBetId: id, rationale: text, ownerOperatorId: id, confidence, reviewAt: id, noViableAlternativeReason: text.optional(), revision: z.number().int().positive().optional() })
async function decisionTarget(db: D1Database, identifier: string) {
  const found = await db.prepare('SELECT id FROM decisions WHERE id=?').bind(identifier).first<{id:string}>()
  if (!found) throw new ToolRefusal('resource_unavailable')
  return { kind: 'decision', id: found.id }
}
export const planningTools = [
  nativeTool({ name: 'penny.decisions.get', title: 'Read a decision', description: 'Read the native decision brief with evidence, alternatives and revision history.', scope: 'decisions:read', readOnly: true, clauses: ['DEC-001','DEC-006'], input: z.object({ slug: id }), output: objectResult,
    run: async (input, { db }) => { const record = await workspaceReadService({ binding: db }).findDecision(input.slug); if (!record) throw new ToolRefusal('resource_unavailable'); return record } }),
  nativeTool({ name: 'penny.decisions.create', title: 'Create a decision brief', description: 'Create a native internal decision question and accountable owner.', scope: 'decisions:write', clauses: ['DEC-001','DEC-002','AGENT-001'], input: decisionInput, output: idResult,
    summary: async input => ({ target: { name: input.question }, items: [input.ownerOperatorId ?? 'Unassigned', input.reviewAt ?? 'No review date'] }), run: (input, { db, actor }) => createDecision(db, input, actor, now()) }),
  nativeTool({ name: 'penny.decisions.update', title: 'Edit a decision brief', description: 'Use native validation and the prohibition on editing an already committed decision.', scope: 'decisions:write', clauses: ['DEC-001','DEC-002','DEC-003'], input: decisionInput.extend({ id }), output: okResult,
    target: (input, { db }) => decisionTarget(db, input.id), summary: async input => ({ target: { id: input.id }, items: [input.question, input.ownerOperatorId ?? 'Unassigned'] }),
    run: async (input, { db, actor }) => { await editDecision(db, input.id, input, actor, now()); return { ok: true } } }),
  nativeTool({ name: 'penny.bets.save', title: 'Add or edit an alternative bet', description: 'Save the native proposed approach, urgency, delivery shape and success measure.', scope: 'decisions:write', clauses: ['DEC-002','DEC-003','AGENT-001'], input: z.object({ decisionId: id, id: id.optional(), title: z.string().trim().min(1).max(280), summary: text, urgency: text.optional(), deliveryShape: text.optional(), successMeasure: text.optional() }), output: idResult,
    target: (input, { db }) => decisionTarget(db, input.decisionId), summary: async input => ({ target: { id: input.decisionId }, items: [input.title, input.summary] }),
    run: (input, { db, actor }) => saveBet(db, input.decisionId, input.id ?? null, input, actor, now()) }),
  nativeTool({ name: 'penny.decisions.commit', title: 'Commit or revise a decision', description: 'Record the native evidence snapshot, accountable decision and unapproved roadmap item. This never publishes customer wording.', scope: 'decisions:write', clauses: ['DEC-004','DEC-005','DEC-006','DEC-007','LEARN-003'], input: commitInput, output: objectResult,
    target: (input, { db }) => decisionTarget(db, input.id), revision: async (input, { db }) => { await decisionTarget(db, input.id); const row = await db.prepare('SELECT COALESCE(MAX(revision_number),0) AS revision FROM decision_revisions WHERE decision_id=?').bind(input.id).first<{revision:number}>(); return String(row!.revision) },
    summary: async input => ({ target: { id: input.id }, items: [input.selectedCandidateBetId, input.rationale, input.ownerOperatorId, input.reviewAt] }),
    run: (input, { db, actor }) => commitDecision(db, input.id, input, actor, now(), input.revision ? { expectedRevision: input.revision } : undefined) }),
  nativeTool({ name: 'penny.decisions.review', title: 'Record an outcome review', description: 'Record a native review note and new review date; a changed bet remains a separate revision.', scope: 'decisions:write', clauses: ['DEC-007','AGENT-005'], input: z.object({ id, note: text, reviewAt: id }), output: objectResult,
    target: (input, { db }) => decisionTarget(db, input.id), summary: async input => ({ target: { id: input.id }, items: [input.note, input.reviewAt] }), run: (input, { db, actor }) => reviewDecision(db, input.id, input, actor, now()) }),
  nativeTool({ name: 'penny.decisions.history', title: 'Read decision revisions', description: 'Read the native immutable commitment and review history.', scope: 'decisions:read', readOnly: true, clauses: ['DEC-006','DEC-007'], input: z.object({ id }), output: objectResult,
    target: (input, { db }) => decisionTarget(db, input.id), run: async (input, { db }) => ({ history: await decisionHistory(db, input.id) }) }),
  nativeTool({ name: 'penny.hierarchy.get', title: 'Read the product hierarchy', description: 'Read the same products, components, features and demand as the operator app.', scope: 'workspace:read', readOnly: true, clauses: ['PRIO-001'], input: z.object({}), output: objectResult,
    run: (_input, { db }) => readHierarchy(db) }),
  nativeTool({ name: 'penny.hierarchy.manage', title: 'Save a product, component or feature', description: 'Use the native hierarchy service; a hierarchy record grants no authority.', scope: 'hierarchy:write', clauses: ['PRIO-001'], input: z.object({ kind: z.enum(['product','component','feature']), id: id.optional(), name: z.string().trim().min(1).max(160), parentId: id.optional() }), output: idResult,
    summary: async input => ({ target: { ...(input.id ? { id: input.id } : {}), name: input.name }, items: [input.kind, input.parentId ?? ''] }), run: (input, { db, actor }) => saveHierarchy(db, input.kind, input.id ?? null, input, actor, now()) }),
  nativeTool({ name: 'penny.hierarchy.link', title: 'Link a feature to native work', description: 'Link or unlink an existing request or roadmap item through the native feature service.', scope: 'hierarchy:write', clauses: ['PRIO-001'], input: z.object({ id, kind: z.enum(['request','roadmap']), targetId: id, linked: z.boolean() }), output: okResult,
    summary: async input => ({ target: { id: input.id }, items: [input.kind, input.targetId, input.linked ? 'Link' : 'Unlink'] }), run: async (input, { db, actor }) => { await linkFeature(db, input.id, input.kind, input.targetId, input.linked, actor, now()); return { ok: true } } }),
  nativeTool({ name: 'penny.views.get', title: 'Read a prioritization view', description: 'The native reader enforces owner-or-shared visibility and calculates its formula.', scope: 'views:read', readOnly: true, clauses: ['OPS-006','PRIO-003'], input: z.object({ id }), output: objectResult,
    run: (input, { db, actor }) => readView(db, input.id, actor) }),
  nativeTool({ name: 'penny.views.save', title: 'Save a prioritization view', description: 'Save native private or shared prioritization. Updates require the current native revision and owner.', scope: 'views:write', clauses: ['OPS-006','PRIO-003'], input: viewInput.extend({ id: id.optional(), revision: z.number().int().positive().optional() }), output: idResult,
    revision: async (input, { db, actor }) => input.id ? String((await readView(db, input.id, actor)).revision) : null,
    summary: async input => ({ target: { ...(input.id ? { id: input.id } : {}), name: input.name }, items: [input.shared ? 'Shared with operators' : 'Private', input.formula, input.entity] }),
    run: (input, { db, actor }) => saveView(db, input.id ?? null, input, actor, now(), input.revision) }),
  nativeTool({ name: 'penny.accounts.update', title: 'Create or edit internal account context', description: 'Save native account value and ownership. Revenue is context; no money is moved.', scope: 'accounts:write', clauses: ['EVID-005','OPS-007'], input: z.object({ id: id.optional(), name: z.string().trim().min(1).max(200), internalOwnerId: id, revenueCents: z.number().int().nonnegative().nullable().optional(), renewalDate: id.nullable().optional(), health: z.string().max(200).nullable().optional() }), output: idResult,
    summary: async input => ({ target: { ...(input.id ? { id: input.id } : {}), name: input.name }, items: [input.internalOwnerId, input.health ?? '', input.renewalDate ?? ''] }), run: (input, { db, actor }) => saveAccount(db, input.id ?? null, input, actor, now()) }),
]
