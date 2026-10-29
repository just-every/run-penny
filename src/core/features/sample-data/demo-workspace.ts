import type { PennySample } from './schema'
import { demoContext, demoDate, demoId, demoOwner } from './demo-context'
import { demoTopics } from './demo-topics'

/** The app's one short date style, "7 Nov 2026". */
const shortDay = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

export function createDemoWorkspace(now: Date): PennySample {
  const context = demoContext(now)
  const evidence: PennySample['evidence'] = demoTopics.flatMap((topic, index) => topic.signals.map(([account, sourceType, wording], signal) => ({
    id: demoId(100 + index * 3 + signal), versionId: demoId(200 + index * 3 + signal),
    sourceType, sourceLabel: `${context.accounts[account].name} · ${sourceType === 'sales_call' ? 'account review' : 'customer feedback'}`,
    accountId: demoId(10 + account), requesterId: demoId(20 + account), recordedByOperatorId: demoOwner,
    observedAt: demoDate(now, -topic.daysAgo - 5 + signal * 2),
    reviewState: index < 4 && signal === 2 ? 'unreviewed' : 'reviewed',
    reviewReason: index < 4 && signal === 2 ? null : `Compared in the ${topic.title.toLowerCase()} decision.`,
    wording, tagIds: [demoId(topic.tag)],
  })))
  const requests: PennySample['requests'] = demoTopics.map((topic, index) => ({
    id: demoId(300 + index), slug: topic.slug, boardId: demoId(topic.board),
    authorRequesterId: demoId(20 + topic.signals[0][0]), title: topic.title, description: topic.summary,
    proposedSolution: topic.summary, impactStatement: topic.measure, moderationState: 'approved',
    publicState: topic.status === 'exploring' ? 'under_review' : topic.status,
    publicTitle: topic.title, publicDescription: topic.summary, publishedAt: demoDate(now, -topic.daysAgo - 4),
    declinedReason: null, withdrawnAt: null, evidenceIds: evidence.slice(index * 3, index * 3 + 3).map(item => item.id),
    tagIds: [demoId(topic.tag)], voterIds: topic.signals.map(([account]) => demoId(20 + account)),
    followerIds: topic.signals.map(([account]) => demoId(20 + account)),
    comments: [{
      id: demoId(400 + index), requesterId: null, operatorId: demoOwner, moderationState: 'approved',
      body: topic.status === 'shipped' ? `This is live. Open Updates for the release and tell us how it works for you.` : `Thanks for the examples. ${topic.status === 'in_progress' ? 'The pilot is in progress' : 'We are comparing the options'}; follow this request for updates.`,
      publishedAt: demoDate(now, -topic.daysAgo),
    }],
  }))
  const decisions: PennySample['decisions'] = demoTopics.map((topic, index) => {
    const linked = evidence.slice(index * 3, index * 3 + 3)
    const committed = topic.state === 'committed' || topic.state === 'review_due'
    const reviewAt = demoDate(now, topic.state === 'review_due' ? -1 : 7 + index)
    const rationale = `${topic.summary} The first two accounts need this workflow; retain the alternative for teams with simpler needs. ${topic.tradeoff}`
    const bets = [topic.title, topic.alternative].map((title, alternative) => ({
      id: demoId(600 + index * 2 + alternative), title,
      summary: alternative ? topic.tradeoff : topic.summary,
      urgency: topic.status === 'shipped' ? 'Validate adoption in the next account review.' : 'Requested in recent customer conversations.',
      deliveryShape: alternative ? 'A smaller workflow change with a follow-up review.' : topic.status === 'shipped' ? 'Shipped to the workspace; measuring adoption.' : 'A two-week pilot, followed by a staged rollout.',
      successMeasure: topic.measure, assumptions: 'The named design partners will test this in their normal workflow.',
      counterEvidence: topic.tradeoff, accountIds: topic.signals.map(([account]) => demoId(10 + account)),
      evidenceLinks: linked.map((item, signal) => ({ evidenceId: item.id, stance: (signal === 2) === Boolean(alternative) ? 'supporting' as const : 'contradicting' as const })),
    }))
    return {
      id: demoId(500 + index), slug: `decision-${topic.slug}`, title: topic.title, question: topic.question,
      state: topic.state, ownerOperatorId: demoOwner, confidence: topic.state === 'draft' ? 'medium' : 'high', reviewAt,
      selectedCandidateBetId: committed ? bets[0].id : null, rationale: committed ? rationale : null, bets,
      revision: committed ? {
        id: demoId(700 + index), revisionNumber: 1, selectedCandidateBetId: bets[0].id, rationale, confidence: 'high', reviewAt,
        noViableAlternativeReason: null, committedByOperatorId: demoOwner,
        snapshots: bets.flatMap((bet, alternative) => bet.evidenceLinks.map((link, signal) => ({
          id: demoId(800 + index * 6 + alternative * 3 + signal), ...link,
          evidenceVersionId: linked[signal].versionId, candidateBetId: bet.id,
        }))),
      } : null,
    }
  })
  return {
    version: 'penny.v1', ...context, evidence, requests, decisions,
    roadmapItems: demoTopics.map((topic, index) => ({
      id: demoId(900 + index), slug: topic.slug, decisionId: decisions[index].id, candidateBetId: decisions[index].bets[0].id,
      title: topic.title, summary: topic.summary, ownerOperatorId: demoOwner, status: topic.status,
      targetWindow: topic.status === 'shipped' ? `Shipped ${shortDay(demoDate(now, -topic.daysAgo))}` : topic.status === 'exploring' ? `Discovery through ${shortDay(demoDate(now, 14))}` : `Week of ${shortDay(demoDate(now, topic.status === 'in_progress' ? 7 : 21))}`,
      deliveryNotes: topic.measure, confidence: topic.state === 'draft' ? 'medium' : 'high',
      transition: { id: demoId(1000 + index), fromStatus: null, toStatus: topic.status, reason: topic.status === 'shipped' ? 'Pilot complete; release approved for customers.' : 'Evidence reviewed in the current planning cycle.', actorOperatorId: demoOwner },
    })),
    // Current domain approval/publication creates the public slugs, sealed
    // release targets and recipient snapshots; v1's older projections cannot.
    roadmapPublications: [], roadmapRequestMappings: [], releases: [],
  }
}
