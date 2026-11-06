import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'

// This tokenizer validates the authored label mix only. Predictions always
// come from the native suggestion route, never from this validation helper.
const terms = text => new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(term => term.length > 1))
const kinds = new Map([['lexical-positive', true], ['paraphrase-positive', true], ['hard-negative', false]])
const ratio = (numerator, denominator) => denominator ? numerator / denominator : null

export async function duplicateCorpus(path) {
 const bytes = await readFile(path), corpus = JSON.parse(bytes), ids = new Set(), pairs = new Set(), candidates = new Map()
 if (typeof corpus.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(corpus.version) || !Array.isArray(corpus.cases) || corpus.cases.length < 300) throw Error('Invalid duplicate corpus: version and at least 300 pairs required')
 for (const row of corpus.cases) {
  if (typeof row.id !== 'string' || !row.id || ids.has(row.id) || !kinds.has(row.kind) || row.duplicate !== kinds.get(row.kind)) throw Error('Invalid duplicate pair identity or label')
  ids.add(row.id)
  for (const request of [row.query, row.candidate]) {
   if (!request || typeof request.title !== 'string' || !request.title.trim() || request.title.length > 280 || typeof request.description !== 'string') throw Error('Invalid duplicate request')
  }
  // The public route accepts a title, so a query description must not silently
  // contribute an unevaluated outcome to its label.
  if (row.query.description !== '' || typeof row.candidate.id !== 'string' || !row.candidate.id) throw Error('Invalid duplicate route input')
  const signature = JSON.stringify([row.candidate.title, row.candidate.description])
  if (candidates.has(row.candidate.id) && candidates.get(row.candidate.id).signature !== signature) throw Error('Conflicting duplicate candidate')
  if (!candidates.has(row.candidate.id)) candidates.set(row.candidate.id, {signature, ...row.candidate})
  const pair = JSON.stringify([row.query.title, row.candidate.id])
  if (pairs.has(pair)) throw Error('Repeated duplicate pair')
  pairs.add(pair)
  const queryTerms = terms(row.query.title), candidateTerms = terms(row.candidate.title + '\n' + row.candidate.description)
  const shared = [...queryTerms].some(term => candidateTerms.has(term))
  if ((row.kind === 'paraphrase-positive' && shared) || (row.kind !== 'paraphrase-positive' && !shared)) throw Error('Duplicate pair violates its shared-term label: ' + row.id)
 }
 const hardNegatives = corpus.cases.filter(row => row.kind === 'hard-negative').length
 const paraphrases = corpus.cases.filter(row => row.kind === 'paraphrase-positive').length
 if (hardNegatives / corpus.cases.length < 0.30 || !paraphrases || candidates.size < 6) throw Error('Invalid duplicate corpus mix or candidate pool')
 return {version:corpus.version, sha256:createHash('sha256').update(bytes).digest('hex'), cases:corpus.cases,
  candidates:[...candidates.values()].map(({id,title,description}) => ({id,title,description})),
  counts:{pairs:corpus.cases.length, candidates:candidates.size, positives:corpus.cases.filter(row => row.duplicate).length,
   negatives:corpus.cases.filter(row => !row.duplicate).length, hardNegatives, paraphrasePositives:paraphrases}}
}

export async function evaluateDuplicates(corpus, runtime) {
 await runtime.seed(corpus.candidates)
 const confusionMatrix = {tp:0, fp:0, fn:0, tn:0}, observations = []
 let topFive = 0, paraphraseHits = 0
 for (const row of corpus.cases) {
  const suggestions = await runtime.suggest(row.query.title)
  const index = suggestions.findIndex(suggestion => suggestion.slug === row.candidate.id), predicted = index >= 0
  confusionMatrix[row.duplicate ? (predicted ? 'tp' : 'fn') : (predicted ? 'fp' : 'tn')]++
  if (row.duplicate && predicted) topFive++
  if (row.kind === 'paraphrase-positive' && predicted) paraphraseHits++
  observations.push({id:row.id, kind:row.kind, duplicate:row.duplicate, predicted, rank:predicted ? index + 1 : null,
   candidate:row.candidate.id, suggestions:suggestions.map(suggestion => suggestion.slug)})
 }
 if (runtime.outboundCalls) throw Error('Lexical evaluation attempted outbound traffic')
 const {tp, fp, fn} = confusionMatrix
 const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn), f1 = ratio(2 * tp, 2 * tp + fp + fn)
 const topFiveRecall = ratio(topFive, corpus.counts.positives), paraphraseRecall = ratio(paraphraseHits, corpus.counts.paraphrasePositives)
 return {set:'duplicates-v1', version:corpus.version, sha256:corpus.sha256, mode:'lexical-baseline',
  door:'/api/public/requests/suggestions', implementation:'src/core/features/requests/suggestions.ts',
  model:{applicable:false, id:null}, promptVersion:null, counts:corpus.counts,
  prediction:{matchedTermsMinimum:1, returnedLimit:5, scope:'labeled pairs in the native top five'},
  confusionMatrix, precision, recall, f1, topFiveRecall, paraphraseRecall,
  capabilityBars:{clause:'AI-001', precision:{minimum:0.90, observed:precision, met:precision !== null && precision >= 0.90},
   recall:{minimum:0.85, observed:recall, met:recall !== null && recall >= 0.85},
   topFiveRecall:{minimum:0.90, observed:topFiveRecall, met:topFiveRecall !== null && topFiveRecall >= 0.90},
   paraphraseImprovement:{minimum:0.15, baseline:paraphraseRecall, met:null, reason:'Requires a semantic model evaluated on this same corpus'}},
  qualityGate:{applicable:false, reason:'Lexical floor measurement; no semantic model is qualified'},
  cost:{providerCalls:runtime.outboundCalls, amount:0, currency:'USD'}, observations}
}
