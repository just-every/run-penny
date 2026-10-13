import { drizzle } from 'drizzle-orm/d1'
import type { DatabaseConnection } from '../../platform/database'
import { releaseTargets, releases, operators, tags } from '../../shared/schema'
import type { PennySample } from '../sample-data/schema'

export class ReleasesRepository {
  private readonly database
  private readonly binding: D1Database

  constructor(connection: DatabaseConnection) {
    this.database = drizzle(connection.binding)
    this.binding = connection.binding
  }

  async insertReleases(records: PennySample['releases'], decisionByRoadmapItemId: Map<string, string>, now: string): Promise<void> {
    if (records.length === 0) return
    await this.database.insert(releases).values(records.map((record) => ({
      id: record.id,
      slug: record.slug,
      state: record.state,
      currentVersionId: record.currentVersionId,
      authorOperatorId: record.authorOperatorId,
      publishedAt: record.publishedAt,
      createdAt: now,
      updatedAt: now,
    }))).onConflictDoNothing().run()
    const authorNames=new Map((await this.database.select().from(operators).all()).map(row=>[row.id,row.displayName]))
    const tagNames=new Map((await this.database.select().from(tags).all()).map(row=>[row.id,row.name]))
    // Import the original sample shape on a historical schema as well as the
    // current schema. Current versions capture display metadata at insertion.
    const columns = new Set((await this.binding.prepare('PRAGMA table_info(release_versions)').all<{name:string}>()).results.map(row=>row.name))
    const snapshotColumns = ['author_name','tag_names_json']
    const current = snapshotColumns.every(column=>columns.has(column))
    if (!current && snapshotColumns.some(column=>columns.has(column))) throw new Error('Incomplete release display schema; finish its migration before importing.')
    await this.binding.batch(records.map(record => {
      const names = ['id','release_id','version_number','title','release_type','body','publication_date','setup_url','outcome_prompt','subject_tags_json','is_portal_current','created_at','updated_at']
      const values: (string|number|null)[] = [record.version.id,record.id,record.version.versionNumber,record.version.title,record.version.releaseType,record.version.body,record.version.publicationDate,record.version.setupUrl,record.version.outcomePrompt,JSON.stringify(record.version.subjectTagIds),Number(record.version.isPortalCurrent),now,now]
      if (current) {
        names.push(...snapshotColumns)
        values.push(authorNames.get(record.authorOperatorId)!,JSON.stringify(record.version.subjectTagIds.map(id=>tagNames.get(id)).sort()))
      }
      return this.binding.prepare(`INSERT INTO release_versions(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')}) ON CONFLICT DO NOTHING`).bind(...values)
    }))
    const targets = records.flatMap((record) => record.targetRoadmapItemIds.map((roadmapItemId) => {
      const decisionId = decisionByRoadmapItemId.get(roadmapItemId)
      if (decisionId === undefined) {
        throw new Error(`Release ${record.id} targets an unknown roadmap item`)
      }
      return { releaseId: record.id, roadmapItemId, decisionId, createdAt: now, updatedAt: now }
    }))
    if (targets.length > 0) await this.database.insert(releaseTargets).values(targets).onConflictDoNothing().run()
  }
}
