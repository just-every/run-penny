import type { Output } from './types'

export function MeasurementSummary({body}:{body:Output}) {
 const p=body.protocol,shown=(value:string|number|null)=>value===null||value===''?'Not established':value
 return <section className="measurement-summary" aria-labelledby="measurement-heading"><span className="small-label">BEFORE ACTION</span><h3 id="measurement-heading">Pre-action measurement</h3><p>Proposed comparison plan. Baselines and outcomes still need observation; these are not measured results.</p>
 <dl className="measurement-grid">{([['Outcome measure',p.measure],['Eligible cohort',p.cohort],['Cohort denominator',p.denominator],['Baseline',p.baseline],['Measurement window',p.window],['Comparison',p.comparison]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{shown(value)}</dd></div>)}</dl>
 <div className="option-measures"><p>Apply the same cohort, baseline and window when comparing these options:</p><div className="options-grid">{body.options.map(o=><article key={o.id}><h4>{o.title}</h4><dl><dt>Success measure</dt><dd>{o.successMeasure}</dd><dt>Comparison</dt><dd>{shown(p.comparison)}</dd></dl></article>)}</div></div><p>Review and edit this protocol in Needs you before recording a choice.</p></section>
}
