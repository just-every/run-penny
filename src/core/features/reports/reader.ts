import type { VolumeWindow } from './input'

type BoardCount = { boardId: string; boardSlug: string; boardName: string; count: number }
type SourceCount = { sourceType: string; count: number }
type RequestDay = BoardCount & { date: string }
type EvidenceDay = SourceCount & { date: string }
export type VolumeReport = Awaited<ReturnType<typeof readFeedbackVolume>>

export async function readFeedbackVolume(db: D1Database, window: VolumeWindow) {
  // Count captured records independently of versions, votes and evidence links.
  // One guarded batch gives both series the same database snapshot and authority.
  const [requests, evidence] = await db.batch([
    db.prepare(`SELECT strftime('%Y-%m-%d', r.created_at) AS date,
      b.id AS boardId, b.slug AS boardSlug, b.name AS boardName, COUNT(*) AS count
      FROM requests r JOIN boards b ON b.id=r.board_id
      WHERE julianday(r.created_at)>=julianday(?) AND julianday(r.created_at)<julianday(?)
      GROUP BY date,b.id ORDER BY date,b.slug,b.id`).bind(window.from, window.to),
    db.prepare(`SELECT strftime('%Y-%m-%d', created_at) AS date, source_type AS sourceType, COUNT(*) AS count
      FROM evidence_items
      WHERE julianday(created_at)>=julianday(?) AND julianday(created_at)<julianday(?)
      GROUP BY date,source_type ORDER BY date,source_type`).bind(window.from, window.to),
  ])
  const requestDays = requests.results as RequestDay[], evidenceDays = evidence.results as EvidenceDay[]
  const boards = new Map<string, BoardCount>(), sources = new Map<string, SourceCount>()
  for (const { date: _, ...row } of requestDays) {
    const prior = boards.get(row.boardId)
    boards.set(row.boardId, { ...row, count: (prior?.count ?? 0) + row.count })
  }
  for (const { date: _, ...row } of evidenceDays) {
    const prior = sources.get(row.sourceType)
    sources.set(row.sourceType, { ...row, count: (prior?.count ?? 0) + row.count })
  }
  const requestsByBoard = [...boards.values()].sort((a, b) => a.boardSlug.localeCompare(b.boardSlug))
  const evidenceBySource = [...sources.values()].sort((a, b) => a.sourceType.localeCompare(b.sourceType))
  const sum = (rows: { count: number }[]) => rows.reduce((total, row) => total + row.count, 0)
  const daily = []
  for (let day = Date.parse(window.from.slice(0, 10)); day < Date.parse(window.to); day += 86400000) {
    const date = new Date(day).toISOString().slice(0, 10)
    const requestsByBoard = requestDays.filter(row => row.date === date).map(row => ({ boardId: row.boardId, boardSlug: row.boardSlug, boardName: row.boardName, count: row.count }))
    const evidenceBySource = evidenceDays.filter(row => row.date === date).map(row => ({ sourceType: row.sourceType, count: row.count }))
    daily.push({ date, requests: sum(requestsByBoard), evidence: sum(evidenceBySource), requestsByBoard, evidenceBySource })
  }
  return {
    window: { ...window, timezone: 'UTC', endExclusive: true },
    totals: { requests: sum(requestsByBoard), evidence: sum(evidenceBySource) },
    requestsByBoard, evidenceBySource, daily,
  }
}
