import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

async function command(args) {
 // Model and provider credentials are absent even if the host has them.
 const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|MAIL|MODEL|OPENAI|ANTHROPIC|GEMINI|CLOUDFLARE)/i.test(key)))
 const child = spawn(process.execPath, ['scripts/ai-eval/run.mjs', ...args], {env, stdio:['ignore','pipe','pipe']})
 const stdout=[], stderr=[]
 child.stdout.on('data', bytes => stdout.push(bytes))
 child.stderr.on('data', bytes => stderr.push(bytes))
 const exit = await new Promise((resolve,reject) => {child.once('error',reject); child.once('close',resolve)})
 return {exit, stdout:Buffer.concat(stdout).toString(), stderr:Buffer.concat(stderr).toString()}
}

function assertMetrics(report,cases) {
 const matrix={tp:0,fp:0,fn:0,tn:0}
 let topFive=0,paraphrases=0,paraphraseHits=0
 for (const [index,row] of report.observations.entries()) {
  assert.equal(row.id,cases[index].id)
  assert.equal(row.duplicate,cases[index].duplicate)
  assert.equal(row.predicted,row.suggestions.includes(row.candidate))
  assert.equal(row.rank,row.predicted ? row.suggestions.indexOf(row.candidate)+1 : null)
  matrix[row.duplicate ? (row.predicted?'tp':'fn') : (row.predicted?'fp':'tn')]++
  if(row.duplicate && row.rank!==null && row.rank<=5)topFive++
  if(row.kind==='paraphrase-positive'){paraphrases++;if(row.predicted)paraphraseHits++}
 }
 assert.equal(report.observations.length,cases.length)
 assert.deepEqual(report.confusionMatrix,matrix)
 assert.equal(report.precision,matrix.tp / (matrix.tp+matrix.fp))
 assert.equal(report.recall,matrix.tp / (matrix.tp+matrix.fn))
 assert.equal(report.f1,2*matrix.tp / (2*matrix.tp+matrix.fp+matrix.fn))
 assert.equal(report.topFiveRecall,topFive / report.counts.positives)
 assert.equal(report.paraphraseRecall,paraphraseHits / paraphrases)
 assert.equal(report.capabilityBars.precision.met,report.precision>=report.capabilityBars.precision.minimum)
 assert.equal(report.capabilityBars.recall.met,report.recall>=report.capabilityBars.recall.minimum)
 assert.equal(report.capabilityBars.topFiveRecall.met,report.topFiveRecall>=report.capabilityBars.topFiveRecall.minimum)
 assert.equal(report.capabilityBars.paraphraseImprovement.met,null)
}

export async function proveAiEvaluationCommand() {
 const directory = await mkdtemp(join(tmpdir(),'penny-ai-command-'))
 try {
  const path=join(directory,'report.json'), corpusPath='tests/fixtures/ai/duplicates-v1/cases.json'
  const result=await command(['--set','duplicates-v1','--output',path])
  assert.equal(result.exit,0,result.stderr)
  const report=JSON.parse(result.stdout), bytes=await readFile(corpusPath), corpus=JSON.parse(bytes)
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),report)
  assert.equal(report.version,corpus.version)
  assert.equal(report.sha256,createHash('sha256').update(bytes).digest('hex'))
  assert.equal(report.counts.pairs,corpus.cases.length)
  assert.ok(report.counts.hardNegatives / report.counts.pairs >= 0.30)
  assert.ok(report.counts.paraphrasePositives > 0)
  assert.deepEqual(report.model,{applicable:false,id:null})
  assert.equal(report.promptVersion,null)
  assert.deepEqual(report.cost,{providerCalls:0,amount:0,currency:'USD'})
  assert.equal(report.qualityGate.applicable,false)
  // A hand-labeled control: retrieving billing invoices is the same need;
  // correcting them differs; fetching charge documents is a disjoint paraphrase.
  // These expected outcomes are independent of the evaluator's metric formulas.
  const control=report.observations.slice(0,3)
  assert.deepEqual(control.map(row=>[row.duplicate,row.predicted,row.rank]),[[true,true,1],[false,true,1],[true,false,null]])
  assertMetrics(report,corpus.cases)
  // Six identical duplicate needs compete for five native response positions.
  // The sixth is a false negative; a different correction need is a false
  // positive for a returned candidate and a true negative for the excluded one.
  // This control gives all four confusion outcomes known independently of the
  // scorer and proves that shared terms alone do not count as a retrieved pair.
  const rankedCorpus=structuredClone(corpus), rankedTitle='Export invoice records for annual audit'
  const candidates=Array.from({length:6},(_,index)=>({
   id:`synthetic-penny-ranking-${index+1}`,title:rankedTitle,description:'',
  }))
  rankedCorpus.version='1.0.1'
  rankedCorpus.cases.push(...candidates.map((candidate,index)=>({
   id:`synthetic-penny-ranked-positive-${index+1}`,kind:'lexical-positive',duplicate:true,
   query:{title:rankedTitle,description:''},candidate,
  })),...[0,4,5].map(index=>({
   id:`synthetic-penny-ranked-negative-${index+1}`,kind:'hard-negative',duplicate:false,
   query:{title:'Correct invoice records for annual audit',description:''},candidate:candidates[index],
  })))
  const rankedPath=join(directory,'ranked-corpus.json')
  await writeFile(rankedPath,JSON.stringify(rankedCorpus))
  const rankedResult=await command(['--set','duplicates-v1','--corpus',rankedPath])
  assert.equal(rankedResult.exit,0,rankedResult.stderr)
  const rankedReport=JSON.parse(rankedResult.stdout), ranked=rankedReport.observations.slice(corpus.cases.length)
  assertMetrics(rankedReport,rankedCorpus.cases)
  const expectedSlugs=candidates.slice(0,5).map(row=>row.id)
  assert.deepEqual(ranked.map(row=>[row.duplicate,row.predicted,row.rank]),[
   [true,true,1],[true,true,2],[true,true,3],[true,true,4],[true,true,5],[true,false,null],
   [false,true,1],[false,true,5],[false,false,null],
  ])
  for(const row of ranked)assert.deepEqual(row.suggestions,expectedSlugs)
  assert.deepEqual(rankedReport.cost,{providerCalls:0,amount:0,currency:'USD'})
  // Invalid labels must fail before a report or runtime can be presented.
  corpus.cases[1].duplicate=true
  const invalid=join(directory,'invalid.json'), absent=join(directory,'absent-report.json')
  await writeFile(invalid,JSON.stringify(corpus))
  const refused=await command(['--set','duplicates-v1','--corpus',invalid,'--output',absent])
  assert.notEqual(refused.exit,0)
  assert.match(refused.stderr,/Invalid duplicate pair identity or label/)
  await assert.rejects(readFile(absent),{code:'ENOENT'})
  const redaction=await command(['--set','redaction-v1'])
  assert.equal(redaction.exit,0,redaction.stderr)
  const previous=JSON.parse(redaction.stdout)
  assert.equal(previous.passed,true)
  assert.deepEqual(previous.failed,[])
  assert.ok(previous.labeledSpans>0)
 } finally {await rm(directory,{recursive:true,force:true})}
}
