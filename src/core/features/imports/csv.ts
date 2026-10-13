// Classic saved feedback CSV only. Preserve quoted newlines, Unicode and exact
// original bytes; duplicate headings and broken quoting cannot discard data.
export function parseFeedbackCsv(text: string,inspect?:(headings:string[])=>void): Record<string,string>[] {
 const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false
 const field = () => { row.push(cell); cell = ''; closed = false }
 const line = () => { field(); rows.push(row); row = [] }
 for (let i = 0; i < text.length; i++) {
  const c = text[i]
  if (quoted) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++ } else { quoted = false; closed = true } } else cell += c; continue }
  if (c === '"') { if (cell || closed) throw new Error('CSV_QUOTING'); quoted = true }
  else if (c === ',') field()
  else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; line() }
  else { if (closed) throw new Error('CSV_QUOTING'); cell += c }
 }
 if (quoted) throw new Error('CSV_QUOTING')
 if (cell || row.length || closed) line()
 const headings = rows.shift()?.map((s,i) => i ? s : s.replace(/^\uFEFF/, ''))
 if (!headings?.length || new Set(headings).size !== headings.length || headings.some(s => !s)) throw new Error('CSV_HEADINGS')
 inspect?.(headings)
 return rows.map(values => { if (values.length !== headings.length) throw new Error('CSV_COLUMNS'); return Object.fromEntries(headings.map((key,i) => [key,values[i]])) })
}

// A full-cell mapping avoids guessing separators or coalescing same-name tags.
export function feedbackCsvTags(cell: string, mapping?: Record<string,string[]>): string[] {
 const tags=cell ? mapping?.[cell] : []
 if(!Array.isArray(tags)||tags.some(tag=>typeof tag!=='string'||!tag)||new Set(tags).size!==tags.length||(cell&&!tags.length))throw new Error('CSV_TAG_MAPPING_REQUIRED')
 return tags
}
