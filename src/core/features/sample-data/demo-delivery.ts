import type { DatabaseConnection } from '../../platform/database'
import type { RequesterIdentity } from '../auth/requester'
import { RequestWriteRepository } from '../requests/write-repository'
import { approveRoadmap } from '../roadmap/write-service'
import { saveReleaseDraft } from '../releases/drafts'
import { publishRelease } from '../releases/publication'
import { recordOutcome } from '../releases/outcomes'
import { demoDate, demoOwner } from './demo-context'
import { demoTopics } from './demo-topics'
import type { PennySample } from './schema'

/** Use the current approval and publication path so every public item has its
 * real slug, immutable wording, target/recipient snapshots and adoption report. */
export async function seedDemoDelivery(database: DatabaseConnection, sample: PennySample, now: Date): Promise<void> {
  const db = database.binding
  const requests = new RequestWriteRepository(database)
  for (const [index, topic] of demoTopics.entries()) {
    const request = sample.requests[index]
    const item = sample.roadmapItems[index]
    const publishedAt = demoDate(now, -topic.daysAgo)
    const identities: RequesterIdentity[] = topic.signals.map(([account]) => {
      const person = sample.requesters[account]
      return { requesterId: person.id, addressId: person.addressId, displayName: person.displayName, verifiedEmail: person.email, source: 'email' }
    })
    for (const identity of identities) await requests.follow(identity, request.slug, demoDate(now, -topic.daysAgo - 3))
    if (!await db.prepare('SELECT id FROM roadmap_publications WHERE roadmap_item_id=?').bind(item.id).first()) {
      await approveRoadmap(db, item.id, {
        publicTitle: topic.title, publicSummary: topic.summary,
        boardSlug: sample.boards.find(board => board.id === request.boardId)!.slug, requestIds: [request.id],
      }, demoOwner, publishedAt)
    }
    if (topic.status !== 'shipped') continue
    const existing = await db.prepare('SELECT r.slug FROM releases r JOIN release_targets t ON t.release_id=r.id WHERE t.roadmap_item_id=? LIMIT 1').bind(item.id).first<{ slug: string }>()
    const release = existing ?? await saveReleaseDraft(db, {
      title: topic.title, body: `${topic.summary}\n\n${releaseNotes[topic.slug]}\n\nThanks to everyone who shared their workflow. Open the feedback request to tell us what is working and what still needs attention.`,
      releaseType: topic.slug === 'audit-log-export' ? 'new' : 'improved', tagIds: request.tagIds,
      publicationDate: publishedAt.slice(0, 10), targetIds: [item.id], authorOperatorId: demoOwner,
    }, undefined, publishedAt, demoOwner)
    await publishRelease(db, release.slug, publishedAt, demoOwner)
    // Sample people respond through the same domain admission and versioning as
    // a real requester; repeating the seed preserves their existing answers.
    for (const [response, identity] of identities.slice(0, 2).entries()) {
      const answered = await db.prepare(`SELECT o.id FROM release_outcomes o JOIN releases r ON r.current_version_id=o.release_version_id WHERE r.slug=? AND o.requester_id=? AND o.roadmap_item_id=?`).bind(release.slug, identity.requesterId, item.id).first()
      if (!answered) await recordOutcome(database, release.slug, identity, { targetId: item.id, outcome: response === 0 ? 'adopted' : 'partly_adopted' })
    }
  }
}

const releaseNotes: Record<string, string> = {
  'audit-log-export': 'Choose a date range in the audit log and download the changes as a CSV, including the actor and time. The export follows your workspace access permissions.',
  'bulk-feedback-triage': 'Select the feedback you have read, apply a shared tag or record one review reason for the group. Each note keeps its original wording, speaker and account.',
  'search-by-customer': 'Search a customer name to find its account, attributed feedback and linked decisions together. You can still open the account timeline for the full history.',
}
