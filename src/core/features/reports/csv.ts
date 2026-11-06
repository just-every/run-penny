import type { VolumeReport } from './reader'

// Quote every cell, escape embedded quotes, and neutralize spreadsheet formulas.
function cell(value: unknown) {
  const text = String(value)
  return '"' + (/^\s*[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"'
}
export function volumeCsv(report: VolumeReport) {
  const rows: unknown[][] = [['from', 'to', 'period', 'date', 'metric', 'group_id', 'group_label', 'count']]
  const add = (period: string, date: string, metric: string, id: string, label: string, count: number) =>
    rows.push([report.window.from, report.window.to, period, date, metric, id, label, count])
  const groups = (period: string, date: string, requests: number, evidence: number,
    boards: VolumeReport['requestsByBoard'], sources: VolumeReport['evidenceBySource']) => {
    add(period, date, 'requests', '', '', requests)
    add(period, date, 'evidence', '', '', evidence)
    for (const row of boards) add(period, date, 'requests', row.boardSlug, row.boardName, row.count)
    for (const row of sources) add(period, date, 'evidence', row.sourceType, row.sourceType, row.count)
  }
  groups('window', '', report.totals.requests, report.totals.evidence, report.requestsByBoard, report.evidenceBySource)
  for (const day of report.daily) groups('daily', day.date, day.requests, day.evidence, day.requestsByBoard, day.evidenceBySource)
  return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
